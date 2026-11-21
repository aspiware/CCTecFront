import { Component, NO_ERRORS_SCHEMA, OnDestroy } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { EventData } from '@nativescript/core';
import {
  BarcodeFormats,
  CameraPosition,
  DetectionEvent,
  DetectionType,
  MLKitView,
} from '@nativescript/mlkit-core';
import { MLKitModule } from '@nativescript/mlkit-core/angular';
import { BarcodeResult } from '@nativescript/mlkit-barcode-scanning';

@Component({
  standalone: true,
  selector: 'app-ezee-equipment-scanner',
  imports: [NativeScriptCommonModule, MLKitModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-equipment-scanner.component.html',
  styleUrl: './ezee-equipment-scanner.component.scss',
})
export class EzeeEquipmentScannerComponent implements OnDestroy {
  public readonly detectionType = DetectionType.Barcode;
  public readonly cameraPosition = CameraPosition.BACK;
  public readonly barcodeFormats = [BarcodeFormats.ALL];
  public readonly fieldLabel: string;
  public permissionError = '';
  public isTorchOn = false;
  private scanner?: MLKitView;
  private hasResult = false;

  public constructor(private modalParams: ModalDialogParams) {
    this.fieldLabel = String(this.modalParams.context?.fieldLabel || 'equipment code');
  }

  public ngOnDestroy(): void {
    if (this.scanner) {
      this.scanner.torchOn = false;
    }
    this.scanner?.stopPreview();
  }

  public async onScannerLoaded(event: EventData): Promise<void> {
    this.scanner = event.object as MLKitView;
    if (!MLKitView.isAvailable()) {
      this.permissionError = 'Barcode scanning is not available on this device.';
      return;
    }

    try {
      if (!this.scanner.hasCameraPermission()) {
        await this.scanner.requestCameraPermission();
      }
      this.scanner.startPreview();
    } catch {
      this.permissionError = 'Camera access is required to scan equipment codes.';
    }
  }

  public onDetection(event: DetectionEvent): void {
    if (this.hasResult || event.type !== DetectionType.Barcode) {
      return;
    }

    const results = Array.isArray(event.data) ? event.data : [event.data];
    const barcode = results[0] as BarcodeResult | undefined;
    const value = String(barcode?.rawValue || barcode?.displayValue || '').trim();
    if (!value) {
      return;
    }

    this.hasResult = true;
    if (this.scanner) {
      this.scanner.torchOn = false;
      this.scanner.pause = true;
      this.scanner.stopPreview();
    }
    this.modalParams.closeCallback(value);
  }

  public toggleTorch(): void {
    if (!this.scanner || this.permissionError) {
      return;
    }
    this.isTorchOn = !this.isTorchOn;
    this.scanner.torchOn = this.isTorchOn;
  }

  public cancel(): void {
    if (this.scanner) {
      this.scanner.torchOn = false;
    }
    this.modalParams.closeCallback();
  }
}
