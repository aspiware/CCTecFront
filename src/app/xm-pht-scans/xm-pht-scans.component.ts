import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { Application, Page } from '@nativescript/core';
import {
  CameraUpdate,
  GoogleMap,
  MapReadyEvent,
  MapTapEvent,
  Marker,
} from '@nativescript/google-maps';
import { GoogleMapsModule } from '@nativescript/google-maps/angular';

@Component({
  standalone: true,
  selector: 'app-xm-pht-scans',
  imports: [NativeScriptCommonModule, GoogleMapsModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './xm-pht-scans.component.html',
  styleUrl: './xm-pht-scans.component.scss',
})
export class XmPhtScansComponent implements OnInit, OnDestroy {
  public isDarkTheme = Application.systemAppearance() === 'dark';
  public mapLat = 29.7604;
  public mapLng = -95.3698;
  public mapZoom = 11;
  public selectedLatitude: number | null = null;
  public selectedLongitude: number | null = null;

  private appearanceChangedHandler?: () => void;
  private googleMap?: GoogleMap;
  private selectedMarker?: Marker;

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
    this.cdr.detectChanges();
  }

  public onMapTap(args: MapTapEvent): void {
    const { lat, lng } = args.coordinate;

    this.mapLat = lat;
    this.mapLng = lng;
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

    this.googleMap?.animateCamera(CameraUpdate.fromCoordinate({ lat, lng }, this.mapZoom));
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
