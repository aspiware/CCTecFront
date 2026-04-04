import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NativeScriptCommonModule, NativeScriptFormsModule } from '@nativescript/angular';
import { Application, CoreTypes, Page, alert } from '@nativescript/core';
import { getString } from '@nativescript/core/application-settings';
import {
  CameraUpdate,
  GoogleMap,
  MapReadyEvent,
  MapTapEvent,
  Marker,
} from '@nativescript/google-maps';
import { GoogleMapsModule } from '@nativescript/google-maps/angular';
import * as geolocation from '@nativescript/geolocation';
import { firstValueFrom } from 'rxjs';
import { TodayService } from '../today/today.service';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';

@Component({
  standalone: true,
  selector: 'app-xm-ingress',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, GoogleMapsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './xm-ingress.component.html',
  styleUrl: './xm-ingress.component.scss',
})
export class XmIngressComponent implements OnInit, OnDestroy {
  private static readonly DEFAULT_LAT = 29.7604;
  private static readonly DEFAULT_LNG = -95.3698;
  private static readonly DEFAULT_ZOOM = 11;
  private static readonly CURRENT_LOCATION_ZOOM = 19;
  private static readonly TEST_WORK_ORDER_NUMBER = '00000000000000000000';
  private static readonly DEFAULT_SAMPLE_COUNT = '250';

  public isDarkTheme = Application.systemAppearance() === 'dark';
  public mapLat = XmIngressComponent.DEFAULT_LAT;
  public mapLng = XmIngressComponent.DEFAULT_LNG;
  public mapZoom = XmIngressComponent.DEFAULT_ZOOM;
  public selectedLatitude: number | null = null;
  public selectedLongitude: number | null = null;
  public selectedScanLocationIndex = 0;
  public tapPortInput = XmIngressComponent.DEFAULT_SAMPLE_COUNT;
  public isSending = false;
  public scanLocationList = [
    'Tap',
    'Ground Block',
    'Living Room',
    'Family Room',
    'Main Room',
    'Media Box',
    'Bedroom 1',
    'Bedroom 2',
    'Guest Room',
    'Media Room',
    'Basement',
    'Den',
    'Kitchen',
    'Office',
    'Other',
  ];

  private appearanceChangedHandler?: () => void;
  private googleMap?: GoogleMap;
  private selectedMarker?: Marker;
  private scanLocationMarkers = new Map<string, { marker: Marker; lat: number; lng: number }>();
  private currentLatitude?: number;
  private currentLongitude?: number;
  private currentJob: any = null;
  private userId = 0;
  private bp = '';

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private page: Page,
    private todayService: TodayService,
    private configService: ConfigService,
    private usersService: UsersService
  ) {}

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    this.userId = Number(this.usersService.getUser()?.userId || 0);
    this.bp = getString('bp', '');
    this.route.queryParams.subscribe((params) => {
      this.currentJob = this.normalizeJobParams(params || {});
      this.resetMarkerState();
      this.setRandomSampleCount();
      this.restorePersistedState();
    });
    void this.loadCurrentLocation();
  }

  ngOnDestroy(): void {
    if (this.appearanceChangedHandler) {
      Application.off(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
    }
  }

  public onRootLoaded(): void {
    this.syncTheme();
    this.cdr.detectChanges();
  }

  public onMapReady(args: MapReadyEvent): void {
    this.googleMap = args.map;
    this.googleMap.myLocationEnabled = true;

    this.renderPersistedMarkers();
    this.syncSelectedMarkerFromLocation();

    if (this.currentLatitude !== undefined && this.currentLongitude !== undefined) {
      this.centerMap(
        this.currentLatitude,
        this.currentLongitude,
        XmIngressComponent.CURRENT_LOCATION_ZOOM
      );
    }

    this.cdr.detectChanges();
  }

  public onMapTap(args: MapTapEvent): void {
    const { lat, lng } = args.coordinate;
    const scanLocation = this.selectedScanLocation;
    const existingEntry = this.scanLocationMarkers.get(scanLocation);

    this.selectedLatitude = lat;
    this.selectedLongitude = lng;
    this.selectedMarker?.hideInfoWindow();

    if (existingEntry) {
      existingEntry.lat = lat;
      existingEntry.lng = lng;
      existingEntry.marker.position = { lat, lng };
      existingEntry.marker.title = scanLocation;
      existingEntry.marker.snippet = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      this.selectedMarker = existingEntry.marker;
    } else {
      const marker = this.googleMap?.addMarker({
        position: { lat, lng },
        title: scanLocation,
        snippet: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        color: '#2563eb',
      });

      if (!marker) {
        this.cdr.detectChanges();
        return;
      }

      this.scanLocationMarkers.set(scanLocation, { marker, lat, lng });
      this.selectedMarker = marker;
    }

    this.selectedMarker?.showInfoWindow();
    this.persistMarkerState();

    this.cdr.detectChanges();
  }

  public onScanLocationChange(): void {
    const scanLocation = this.selectedScanLocation;
    const existingEntry = this.scanLocationMarkers.get(scanLocation);

    this.selectedMarker?.hideInfoWindow();

    if (!existingEntry) {
      this.selectedMarker = undefined;
      this.selectedLatitude = null;
      this.selectedLongitude = null;
      this.restoreTapConfig();
      this.persistMarkerState();
      this.cdr.detectChanges();
      return;
    }

    this.selectedMarker = existingEntry.marker;
    this.selectedLatitude = existingEntry.lat;
    this.selectedLongitude = existingEntry.lng;
    this.selectedMarker.title = scanLocation;
    this.selectedMarker.showInfoWindow();
    this.restoreTapConfig();
    this.persistMarkerState();
    this.cdr.detectChanges();
  }

  public clearSelectedPoint(): void {
    if (this.selectedMarker) {
      this.scanLocationMarkers.delete(this.selectedScanLocation);
      this.googleMap?.removeMarker(this.selectedMarker);
      this.selectedMarker = undefined;
    }

    this.selectedLatitude = null;
    this.selectedLongitude = null;
    this.persistMarkerState();
    this.cdr.detectChanges();
  }

  public get latitudeText(): string {
    return this.selectedLatitude === null ? 'Tap the map to select a point.' : this.selectedLatitude.toFixed(6);
  }

  public get longitudeText(): string {
    return this.selectedLongitude === null ? 'Waiting for selection' : this.selectedLongitude.toFixed(6);
  }

  public get selectedScanLocation(): string {
    return this.scanLocationList[this.selectedScanLocationIndex] || this.scanLocationList[0];
  }

  public get selectedTapPortNumber(): number {
    return Number(String(this.tapPortInput || '').trim() || XmIngressComponent.DEFAULT_SAMPLE_COUNT);
  }

  public get isTapScanLocation(): boolean {
    return this.selectedScanLocation === 'Tap';
  }

  public async sendPHT(): Promise<void> {
    const workOrderNumber = String(
      this.currentJob?.workOrderNumber || XmIngressComponent.TEST_WORK_ORDER_NUMBER || ''
    ).trim();

    if (!this.userId || !workOrderNumber) {
      await alert({
        title: 'Missing Job',
        message: 'Open XM Ingress from a job or set a valid work order number for testing.',
        okButtonText: 'OK',
      });
      return;
    }

    if (this.selectedLatitude === null || this.selectedLongitude === null) {
      await alert({
        title: 'Missing Location',
        message: 'Select a point on the map before sending ingress data.',
        okButtonText: 'OK',
      });
      return;
    }

    if (this.isSending) {
      return;
    }

    this.isSending = true;
    this.cdr.detectChanges();

    try {
      const payload: any = {
        userId: this.userId,
        bp: this.bp,
        workOrderNumber,
        location: this.selectedScanLocation,
        lat: this.selectedLatitude,
        lon: this.selectedLongitude,
      };

      if (this.isTapScanLocation) {
        payload.locationData = {
          tapPort: this.selectedTapPortNumber,
        };
      }

      await firstValueFrom(this.todayService.sendPHTScans(payload));
      this.persistTapConfig();

      await alert({
        title: 'Ingress Sent',
        message: 'Ingress scan data was sent successfully.',
        okButtonText: 'OK',
      });
    } catch (error: any) {
      console.log('XM Ingress send failed', error);
      await alert({
        title: 'Send Failed',
        message: error?.message || 'Could not send ingress scan data.',
        okButtonText: 'OK',
      });
    } finally {
      this.isSending = false;
      this.cdr.detectChanges();
    }
  }

  private normalizeJobParams(params: any): any {
    return {
      ...params,
      customer: this.parseJsonParam(params?.customer),
      devices: this.parseJsonParam(params?.devices),
      customJob: this.parseJsonParam(params?.customJob),
    };
  }

  private parseJsonParam(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    const text = value.trim();
    if (!text || text === '[object Object]') {
      return null;
    }

    const looksLikeJson =
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'));
    if (!looksLikeJson) {
      return value;
    }

    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  }

  private async loadCurrentLocation(): Promise<void> {
    try {
      await geolocation.enableLocationRequest(false, true);

      const location = await geolocation.getCurrentLocation({
        desiredAccuracy: CoreTypes.Accuracy.high,
        maximumAge: 10000,
        timeout: 15000,
      });

      if (!location) {
        return;
      }

      this.currentLatitude = location.latitude;
      this.currentLongitude = location.longitude;
      this.centerMap(
        location.latitude,
        location.longitude,
        XmIngressComponent.CURRENT_LOCATION_ZOOM
      );
    } catch (error) {
      console.log('XM Ingress location unavailable', error);
    }
  }

  private centerMap(lat: number, lng: number, zoom = this.mapZoom): void {
    this.mapLat = lat;
    this.mapLng = lng;
    this.mapZoom = zoom;
    this.googleMap?.moveCamera(CameraUpdate.fromCoordinate({ lat, lng }, zoom));
    setTimeout(() => {
      this.googleMap?.moveCamera(CameraUpdate.fromCoordinate({ lat, lng }, zoom));
    }, 150);
    this.cdr.detectChanges();
  }

  private syncTheme(): void {
    const appAppearance = Application.systemAppearance();
    if (appAppearance === 'dark' || appAppearance === 'light') {
      this.isDarkTheme = appAppearance === 'dark';
      return;
    }

    const pageClassName = String(this.page.className || '');
    this.isDarkTheme = pageClassName.includes('ns-dark');
  }

  private resetMarkerState(): void {
    for (const entry of this.scanLocationMarkers.values()) {
      this.googleMap?.removeMarker(entry.marker);
    }

    this.scanLocationMarkers.clear();
    this.selectedMarker = undefined;
    this.selectedLatitude = null;
    this.selectedLongitude = null;
  }

  private get storageKey(): string {
    return String(
      this.currentJob?.workOrderNumber || XmIngressComponent.TEST_WORK_ORDER_NUMBER || ''
    ).trim();
  }

  private restorePersistedState(): void {
    const persisted = this.configService.getXmPhtScanState(this.storageKey);
    if (!persisted) {
      this.restoreTapConfig();
      return;
    }

    if (persisted.selectedScanLocation) {
      const selectedIndex = this.scanLocationList.indexOf(persisted.selectedScanLocation);
      this.selectedScanLocationIndex = selectedIndex >= 0 ? selectedIndex : 0;
    }

    this.renderPersistedMarkers(persisted.markers || {});
    this.syncSelectedMarkerFromLocation();
    this.restoreTapConfig();
    this.cdr.detectChanges();
  }

  private renderPersistedMarkers(
    markers: Record<string, { lat: number; lng: number }> = this.readPersistedMarkers()
  ): void {
    if (!this.googleMap) {
      return;
    }

    for (const [location, coords] of Object.entries(markers)) {
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        continue;
      }

      const existingEntry = this.scanLocationMarkers.get(location);
      if (existingEntry) {
        existingEntry.lat = coords.lat;
        existingEntry.lng = coords.lng;
        existingEntry.marker.position = { lat: coords.lat, lng: coords.lng };
        existingEntry.marker.title = location;
        existingEntry.marker.snippet = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
        continue;
      }

      const marker = this.googleMap.addMarker({
        position: { lat: coords.lat, lng: coords.lng },
        title: location,
        snippet: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
        color: '#2563eb',
      });

      this.scanLocationMarkers.set(location, { marker, lat: coords.lat, lng: coords.lng });
    }
  }

  private readPersistedMarkers(): Record<string, { lat: number; lng: number }> {
    return this.configService.getXmPhtScanState(this.storageKey)?.markers || {};
  }

  private syncSelectedMarkerFromLocation(): void {
    const existingEntry = this.scanLocationMarkers.get(this.selectedScanLocation);
    if (!existingEntry) {
      this.selectedMarker = undefined;
      this.selectedLatitude = null;
      this.selectedLongitude = null;
      return;
    }

    this.selectedMarker = existingEntry.marker;
    this.selectedLatitude = existingEntry.lat;
    this.selectedLongitude = existingEntry.lng;
    this.selectedMarker.showInfoWindow();
  }

  private persistMarkerState(): void {
    const existingState = this.configService.getXmPhtScanState(this.storageKey) || {};
    const markers = Array.from(this.scanLocationMarkers.entries()).reduce(
      (acc, [location, entry]) => {
        acc[location] = { lat: entry.lat, lng: entry.lng };
        return acc;
      },
      {} as Record<string, { lat: number; lng: number }>
    );

      this.configService.setXmPhtScanState(
      this.storageKey,
      {
        selectedScanLocation: this.selectedScanLocation,
        markers,
        tapConfig: existingState.tapConfig,
      }
    );
  }

  private restoreTapConfig(): void {
    if (!this.isTapScanLocation) {
      return;
    }
  }

  private persistTapConfig(): void {
    if (!this.isTapScanLocation) {
      return;
    }

    const existingState = this.configService.getXmPhtScanState(this.storageKey) || {};

    this.configService.setXmPhtScanState(
      this.storageKey,
      {
        selectedScanLocation: this.selectedScanLocation,
        markers: existingState.markers || {},
        tapConfig: {
          tapPort: this.selectedTapPortNumber,
        },
      }
    );
  }

  private setRandomSampleCount(): void {
    const randomSamples = Math.floor(Math.random() * (300 - 200 + 1)) + 250;
    this.tapPortInput = String(randomSamples);
  }
}
