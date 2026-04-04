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
import { QuantityStepperComponent } from '../shared/components/quantity-stepper/quantity-stepper.component';
import { firstValueFrom } from 'rxjs';
import { TodayService } from '../today/today.service';
import { ConfigService } from '../shared/services/config.service';
import { UsersService } from '../shared/services/users.service';

@Component({
  standalone: true,
  selector: 'app-xm-pht-scans',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, GoogleMapsModule, QuantityStepperComponent],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './xm-pht-scans.component.html',
  styleUrl: './xm-pht-scans.component.scss',
})
export class XmPhtScansComponent implements OnInit, OnDestroy {
  private static readonly DEFAULT_LAT = 29.7604;
  private static readonly DEFAULT_LNG = -95.3698;
  private static readonly DEFAULT_ZOOM = 11;
  private static readonly CURRENT_LOCATION_ZOOM = 19;
  private static readonly TEST_WORK_ORDER_NUMBER = '00000000000000000000';
  private static readonly DEFAULT_UPSTREAM = 35;
  private static readonly DEFAULT_DOWNSTREAM = 8;
  private static readonly DEFAULT_TAP_PORT = 2;
  private static readonly DEFAULT_TAP_VALUE = 4;

  public isDarkTheme = Application.systemAppearance() === 'dark';
  public mapLat = XmPhtScansComponent.DEFAULT_LAT;
  public mapLng = XmPhtScansComponent.DEFAULT_LNG;
  public mapZoom = XmPhtScansComponent.DEFAULT_ZOOM;
  public selectedLatitude: number | null = null;
  public selectedLongitude: number | null = null;
  public selectedScanLocationIndex = 0;
  public selectedTapPortIndex = 0;
  public selectedTapValueIndex = 0;
  public upstreamValue = XmPhtScansComponent.DEFAULT_UPSTREAM;
  public downstreamValue = XmPhtScansComponent.DEFAULT_DOWNSTREAM;
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
  public tapPortList = [
    2,
    4,
    8
  ];
  public tapValueList = Array.from({ length: 27 }, (_, index) => index + 4);

  private appearanceChangedHandler?: () => void;
  private googleMap?: GoogleMap;
  private selectedMarker?: Marker;
  private scanLocationMarkers = new Map<string, { marker: Marker; lat: number; lng: number }>();
  private preferredCameraTarget?: { lat: number; lng: number; zoom: number };
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

    if (this.applyPreferredCameraTarget()) {
      this.cdr.detectChanges();
      return;
    }

    if (this.currentLatitude !== undefined && this.currentLongitude !== undefined) {
      this.centerMap(
        this.currentLatitude,
        this.currentLongitude,
        XmPhtScansComponent.CURRENT_LOCATION_ZOOM
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
      this.restoreScanLevelsForSelectedLocation();
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
    this.updatePreferredCameraTarget(existingEntry.lat, existingEntry.lng);
    this.applyPreferredCameraTarget();
    this.restoreScanLevelsForSelectedLocation();
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

  public get selectedTapPort(): string {
    return String(this.tapPortList[this.selectedTapPortIndex] ?? this.tapPortList[0]);
  }

  public get selectedTapValue(): string {
    return String(this.tapValueList[this.selectedTapValueIndex] ?? this.tapValueList[0]);
  }

  public get selectedTapValueNumber(): number {
    return Number(this.tapValueList[this.selectedTapValueIndex] ?? this.tapValueList[0]);
  }

  public get selectedTapPortNumber(): number {
    return Number(this.tapPortList[this.selectedTapPortIndex] ?? this.tapPortList[0]);
  }

  public get isTapScanLocation(): boolean {
    return this.selectedScanLocation === 'Tap';
  }

  public onUpstreamValueChange(value: number): void {
    this.upstreamValue = value;
  }

  public onDownstreamValueChange(value: number): void {
    this.downstreamValue = value;
  }

  public async sendPHT(): Promise<void> {
    const workOrderNumber = String(
      this.currentJob?.workOrderNumber || XmPhtScansComponent.TEST_WORK_ORDER_NUMBER || ''
    ).trim();

    if (!this.userId || !workOrderNumber) {
      await alert({
        title: 'Missing Job',
        message: 'Open XM PHT Scans from a job or set a valid work order number for testing.',
        okButtonText: 'OK',
      });
      return;
    }

    if (this.selectedLatitude === null || this.selectedLongitude === null) {
      await alert({
        title: 'Missing Location',
        message: 'Select a point on the map before sending PHT data.',
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
        upstream: this.upstreamValue,
        downstream: this.downstreamValue,
      };

      if (this.isTapScanLocation) {
        payload.locationData = {
          tapValue: this.selectedTapValueNumber,
          tapPort: this.selectedTapPortNumber,
        };
      }

      await firstValueFrom(this.todayService.sendPHTScans(payload));
      this.persistScanLevelsForSelectedLocation();
      this.persistTapConfig();

      await alert({
        title: 'PHT Sent',
        message: 'PHT scan data was sent successfully.',
        okButtonText: 'OK',
      });
    } catch (error: any) {
      console.log('XM PHT Scans send failed', error);
      await alert({
        title: 'Send Failed',
        message: error?.message || 'Could not send PHT scan data.',
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

      if (this.preferredCameraTarget) {
        return;
      }

      this.centerMap(
        location.latitude,
        location.longitude,
        XmPhtScansComponent.CURRENT_LOCATION_ZOOM
      );
    } catch (error) {
      console.log('XM PHT Scans location unavailable', error);
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
    this.preferredCameraTarget = undefined;
  }

  private get storageKey(): string {
    return String(
      this.currentJob?.workOrderNumber || XmPhtScansComponent.TEST_WORK_ORDER_NUMBER || ''
    ).trim();
  }

  private restorePersistedState(): void {
    const persisted = this.configService.getXmPhtScanState(this.storageKey);
    if (!persisted) {
      this.restoreScanLevelsForSelectedLocation();
      this.restoreTapConfig();
      return;
    }

    if (persisted.selectedScanLocation) {
      const selectedIndex = this.scanLocationList.indexOf(persisted.selectedScanLocation);
      this.selectedScanLocationIndex = selectedIndex >= 0 ? selectedIndex : 0;
    }

    this.setPreferredCameraTargetFromPersistedMarkers(persisted.markers || {});
    this.renderPersistedMarkers(persisted.markers || {});
    this.syncSelectedMarkerFromLocation();
    this.applyPreferredCameraTarget();
    this.restoreScanLevelsForSelectedLocation();
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
    this.updatePreferredCameraTarget(existingEntry.lat, existingEntry.lng);
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
        scanLevels: existingState.scanLevels || {},
        tapConfig: existingState.tapConfig,
      }
    );
  }

  private restoreScanLevelsForSelectedLocation(): void {
    const scanLevels = this.configService.getXmPhtScanState(this.storageKey)?.scanLevels || {};
    const savedLevels = scanLevels[this.selectedScanLocation];

    this.upstreamValue = savedLevels?.upstream ?? XmPhtScansComponent.DEFAULT_UPSTREAM;
    this.downstreamValue = savedLevels?.downstream ?? XmPhtScansComponent.DEFAULT_DOWNSTREAM;
  }

  private persistScanLevelsForSelectedLocation(): void {
    const existingState = this.configService.getXmPhtScanState(this.storageKey) || {};
    const scanLevels = {
      ...(existingState.scanLevels || {}),
      [this.selectedScanLocation]: {
        upstream: this.upstreamValue,
        downstream: this.downstreamValue,
      },
    };

    this.configService.setXmPhtScanState(
      this.storageKey,
      {
        selectedScanLocation: this.selectedScanLocation,
        markers: existingState.markers || {},
        scanLevels,
        tapConfig: existingState.tapConfig,
      }
    );
  }

  private restoreTapConfig(): void {
    if (!this.isTapScanLocation) {
      return;
    }

    const tapConfig = this.configService.getXmPhtScanState(this.storageKey)?.tapConfig;
    const tapPortIndex = this.tapPortList.indexOf(
      tapConfig?.tapPort ?? XmPhtScansComponent.DEFAULT_TAP_PORT
    );
    const tapValueIndex = this.tapValueList.indexOf(
      tapConfig?.tapValue ?? XmPhtScansComponent.DEFAULT_TAP_VALUE
    );

    this.selectedTapPortIndex = tapPortIndex >= 0 ? tapPortIndex : 0;
    this.selectedTapValueIndex = tapValueIndex >= 0 ? tapValueIndex : 0;
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
        scanLevels: existingState.scanLevels || {},
        tapConfig: {
          tapPort: this.selectedTapPortNumber,
          tapValue: this.selectedTapValueNumber,
        },
      }
    );
  }

  private setPreferredCameraTargetFromPersistedMarkers(
    markers: Record<string, { lat: number; lng: number }>
  ): void {
    const selectedLocationMarker = markers[this.selectedScanLocation];
    if (selectedLocationMarker) {
      this.updatePreferredCameraTarget(selectedLocationMarker.lat, selectedLocationMarker.lng);
      return;
    }

    const firstMarker = Object.values(markers)[0];
    if (firstMarker) {
      this.updatePreferredCameraTarget(firstMarker.lat, firstMarker.lng);
    }
  }

  private updatePreferredCameraTarget(lat: number, lng: number): void {
    this.preferredCameraTarget = {
      lat,
      lng,
      zoom: XmPhtScansComponent.CURRENT_LOCATION_ZOOM,
    };
    this.mapLat = lat;
    this.mapLng = lng;
    this.mapZoom = XmPhtScansComponent.CURRENT_LOCATION_ZOOM;
  }

  private applyPreferredCameraTarget(): boolean {
    if (!this.preferredCameraTarget) {
      return false;
    }

    this.centerMap(
      this.preferredCameraTarget.lat,
      this.preferredCameraTarget.lng,
      this.preferredCameraTarget.zoom
    );
    return true;
  }
}
