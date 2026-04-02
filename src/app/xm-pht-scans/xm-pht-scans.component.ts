import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule, NativeScriptFormsModule } from '@nativescript/angular';
import { Application, CoreTypes, Page } from '@nativescript/core';
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

  public isDarkTheme = Application.systemAppearance() === 'dark';
  public mapLat = XmPhtScansComponent.DEFAULT_LAT;
  public mapLng = XmPhtScansComponent.DEFAULT_LNG;
  public mapZoom = XmPhtScansComponent.DEFAULT_ZOOM;
  public selectedLatitude: number | null = null;
  public selectedLongitude: number | null = null;
  public selectedScanLocationIndex = 0;
  public selectedTapValueIndex = 0;
  public upstreamValue = 35;
  public downstreamValue = 8;
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

  private appearanceChangedHandler?: () => void;
  private googleMap?: GoogleMap;
  private selectedMarker?: Marker;
  private currentLatitude?: number;
  private currentLongitude?: number;

  constructor(
    private cdr: ChangeDetectorRef,
    private page: Page
  ) {}

  ngOnInit(): void {
    this.syncTheme();
    this.appearanceChangedHandler = () => {
      this.syncTheme();
      this.cdr.detectChanges();
    };
    Application.on(Application.systemAppearanceChangedEvent, this.appearanceChangedHandler);
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

    this.selectedLatitude = lat;
    this.selectedLongitude = lng;

    if (this.selectedMarker) {
      this.googleMap?.removeMarker(this.selectedMarker);
    }

    this.selectedMarker = this.googleMap?.addMarker({
      position: { lat, lng },
      title: 'Selected scan point',
      snippet: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      color: '#2563eb',
    });

    this.cdr.detectChanges();
  }

  public clearSelectedPoint(): void {
    if (this.selectedMarker) {
      this.googleMap?.removeMarker(this.selectedMarker);
      this.selectedMarker = undefined;
    }

    this.selectedLatitude = null;
    this.selectedLongitude = null;
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

  public get selectedTapValue(): string {
    return String(this.tapPortList[this.selectedTapValueIndex] ?? this.tapPortList[0]);
  }

  public onUpstreamValueChange(value: number): void {
    this.upstreamValue = value;
  }

  public onDownstreamValueChange(value: number): void {
    this.downstreamValue = value;
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
}
