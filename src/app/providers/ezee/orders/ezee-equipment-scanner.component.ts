import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnDestroy } from '@angular/core';
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
  public isScannerReady = false;
  public autoFindEquipmentId = false;
  public detectedCode = '';
  private scanner?: MLKitView;
  private hasResult = false;

  public constructor(
    private modalParams: ModalDialogParams,
    private cdr: ChangeDetectorRef
  ) {
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
      this.isScannerReady = true;
      this.cdr.detectChanges();
    } catch {
      this.isScannerReady = false;
      this.permissionError = 'Camera access is required to scan equipment codes.';
      this.cdr.detectChanges();
    }
  }

  public onDetection(event: DetectionEvent): void {
    if (this.hasResult || event.type !== DetectionType.Barcode) {
      return;
    }

    const results = Array.isArray(event.data) ? event.data : [event.data];
    const value = this.autoFindEquipmentId
      ? this.findDsnOrFsan(results as BarcodeResult[])
      : this.firstDetectedValue(results as BarcodeResult[]);
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

  public onAutoFindEquipmentIdChanged(event: any): void {
    this.autoFindEquipmentId = Boolean(event?.value ?? event?.object?.checked ?? false);
    if (!this.autoFindEquipmentId) {
      this.detectedCode = '';
    }
    this.cdr.detectChanges();
  }

  private firstDetectedValue(results: BarcodeResult[]): string {
    for (const barcode of results) {
      const value = String(barcode?.rawValue || barcode?.displayValue || '').trim();
      if (value) {
        return value;
      }
    }
    return '';
  }

  private findDsnOrFsan(results: BarcodeResult[]): string {
    for (const barcode of results) {
      const value = String(barcode?.rawValue || barcode?.displayValue || '')
        .trim()
        .toUpperCase();
      if (!value) {
        continue;
      }
      if (this.detectedCode !== value) {
        this.detectedCode = value;
        this.cdr.detectChanges();
      }

      const separatedDsn = value.match(
        /(?:^|[^A-Z0-9])([A-Z0-9]{4})[-\s]+([A-Z0-9]{4})[-\s]+([A-Z0-9]{4})[-\s]+([A-Z0-9]{4})(?:$|[^A-Z0-9])/
      );
      if (separatedDsn) {
        return separatedDsn.slice(1, 5).join('');
      }

      const withoutLabel = value.replace(/^(?:DSN|FSAN)\s*:?\s*/i, '');
      const compactValue = withoutLabel.replace(/[^A-Z0-9]/g, '');
      if (compactValue.length === 16 && /[A-Z]/.test(compactValue)) {
        return compactValue;
      }

      // A PON FSAN consists of a four-letter vendor ID followed by an
      // eight-character hexadecimal equipment identifier. Extract it from
      // the detected payload because some readers include a symbology prefix,
      // label, control characters, or separators around the barcode value.
      const compactPayload = value.replace(/[^A-Z0-9]/g, '');
      const fsan = compactPayload.match(/[A-Z]{4}[0-9A-F]{8}/);
      if (fsan) {
        return fsan[0];
      }
    }
    return '';
  }

  public toggleTorch(): void {
    if (!this.scanner || !this.isScannerReady || this.permissionError) {
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
