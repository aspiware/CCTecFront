import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit } from '@angular/core';
import { ModalDialogParams, NativeScriptCommonModule } from '@nativescript/angular';
import { Screen, alert, confirm } from '@nativescript/core';
import { MenuEvent } from '../../../shared/components/menu-button/common';
import { Item } from '../../../shared/components/menu-button/item';
import { shareEzeeImages } from '../ezee-file';
import { EzeeOrderListItem } from './ezee-order.model';
import {
  EzeeOrderPhoto,
  EzeeTimestampCameraService,
} from './ezee-timestamp-camera.service';
import { EzeeOrdersService } from './ezee-orders.service';

@Component({
  standalone: true,
  selector: 'app-ezee-order-photos',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './ezee-order-photos.component.html',
  styleUrl: './ezee-order-photos.component.scss',
})
export class EzeeOrderPhotosComponent implements OnInit {
  public order: EzeeOrderListItem;
  public photos: EzeeOrderPhoto[] = [];
  public previewPhoto?: EzeeOrderPhoto;
  public isDeleting = false;
  public includeOrderScreenshot = false;
  public isGeneratingScreenshot = false;
  public readonly photoCellSize = Math.floor((Screen.mainScreen.widthDIPs - 40) / 3);
  public readonly deleteMenu: Item = {
    name: 'Delete Photos',
    options: [
      { name: 'Delete from CCTec', icon: 'trash', destructive: true },
      { name: 'Delete Everywhere', icon: 'trash.slash', destructive: true },
    ],
  };
  private readonly selectedPaths = new Set<string>();
  private isUpdatingScreenshotToggle = false;

  public constructor(
    private modalParams: ModalDialogParams,
    private cameraService: EzeeTimestampCameraService,
    private ordersService: EzeeOrdersService,
    private cdr: ChangeDetectorRef
  ) {
    this.order = this.modalParams.context?.order || ({} as EzeeOrderListItem);
  }

  public ngOnInit(): void {
    this.loadPhotos();
  }

  public get selectedCount(): number {
    return this.selectedPaths.size;
  }

  public get hasOrderScreenshot(): boolean {
    return this.photos.some((photo) => photo.kind === 'screenshot');
  }

  public close(): void {
    if (!this.isDeleting) {
      this.modalParams.closeCallback();
    }
  }

  public isSelected(photo: EzeeOrderPhoto): boolean {
    return this.selectedPaths.has(photo.path);
  }

  public toggleSelection(photo: EzeeOrderPhoto): void {
    if (this.selectedPaths.has(photo.path)) {
      this.selectedPaths.delete(photo.path);
    } else {
      this.selectedPaths.add(photo.path);
    }
    this.cdr.detectChanges();
  }

  public toggleSelectAll(): void {
    if (this.selectedPaths.size === this.photos.length) {
      this.selectedPaths.clear();
    } else {
      this.photos.forEach((photo) => this.selectedPaths.add(photo.path));
    }
    this.cdr.detectChanges();
  }

  public openPreview(photo: EzeeOrderPhoto): void {
    this.previewPhoto = photo;
    this.cdr.detectChanges();
  }

  public closePreview(): void {
    this.previewPhoto = undefined;
    this.cdr.detectChanges();
  }

  public async onIncludeScreenshotChanged(event: any): Promise<void> {
    const enabled = !!event?.value;
    if (this.isUpdatingScreenshotToggle || enabled === this.includeOrderScreenshot) {
      return;
    }

    this.includeOrderScreenshot = enabled;
    this.isUpdatingScreenshotToggle = true;
    this.isGeneratingScreenshot = true;
    this.cdr.detectChanges();
    try {
      const existingScreenshot = this.cameraService.getOrderScreenshot(this.order.number);
      if (enabled && !existingScreenshot) {
        await this.generateAndSaveOrderScreenshot();
      } else if (!enabled && existingScreenshot) {
        await this.cameraService.deleteOrderPhotos(
          this.order.number,
          [existingScreenshot],
          false
        );
      }
    } catch (error) {
      await alert({
        title: 'Order Screenshot',
        message: String((error as any)?.message || 'Unable to update the order screenshot.'),
        okButtonText: 'OK',
      });
    } finally {
      this.isGeneratingScreenshot = false;
      this.isUpdatingScreenshotToggle = false;
      this.loadPhotos();
    }
  }

  public async share(): Promise<void> {
    const photos = this.selectedPhotosOrAll();
    const filePaths = photos.map((photo) => photo.path);
    if (this.includeOrderScreenshot) {
      let screenshot = this.cameraService.getOrderScreenshot(this.order.number);
      if (!screenshot) {
        this.isGeneratingScreenshot = true;
        this.cdr.detectChanges();
        try {
          screenshot = await this.generateAndSaveOrderScreenshot();
          this.loadPhotos();
        } catch (error) {
          await alert({
            title: 'Order Screenshot',
            message: String((error as any)?.message || 'Unable to generate the order screenshot.'),
            okButtonText: 'OK',
          });
          return;
        } finally {
          this.isGeneratingScreenshot = false;
          this.cdr.detectChanges();
        }
      }
      if (screenshot && !filePaths.includes(screenshot.path)) {
        filePaths.push(screenshot.path);
      }
    }
    if (!shareEzeeImages(filePaths, `Share Order ${this.order.number} Photos`)) {
      await alert({
        title: 'Order Photos',
        message: 'Unable to open the share menu.',
        okButtonText: 'OK',
      });
    }
  }

  public onDeleteMenuSelected(event: MenuEvent): void {
    const selected = this.deleteMenu.options[event?.index ?? -1];
    if (selected?.name === 'Delete from CCTec') {
      void this.deleteSelected(false);
    } else if (selected?.name === 'Delete Everywhere') {
      void this.deleteSelected(true);
    }
  }

  private async deleteSelected(deleteEverywhere: boolean): Promise<void> {
    const photos = this.selectedPhotos();
    if (!photos.length || this.isDeleting) {
      return;
    }
    const choice = deleteEverywhere ? 'Delete Everywhere' : 'Delete from CCTec';
    const confirmed = await confirm({
      title: choice,
      message: deleteEverywhere
        ? 'This removes the selected copies from CCTec and Photos when a gallery link is available.'
        : 'This removes the selected copies from this order in CCTec. Copies in Photos will remain.',
      okButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }

    this.isDeleting = true;
    this.cdr.detectChanges();
    try {
      const result = await this.cameraService.deleteOrderPhotos(
        this.order.number,
        photos,
        deleteEverywhere
      );
      if (deleteEverywhere && result.unlinkedGalleryCopies) {
        await alert({
          title: 'Photos Deleted',
          message: `${result.deleted} photo${result.deleted === 1 ? '' : 's'} removed from CCTec. ` +
            `${result.unlinkedGalleryCopies} older or internal-only photo${result.unlinkedGalleryCopies === 1 ? '' : 's'} had no gallery link; any matching Photos copies must be deleted from Photos manually.`,
          okButtonText: 'OK',
        });
      }
      this.loadPhotos();
    } catch (error) {
      await alert({
        title: 'Unable to Delete Photos',
        message: String((error as any)?.localizedDescription || (error as any)?.message || error),
        okButtonText: 'OK',
      });
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }

  private loadPhotos(): void {
    this.photos = this.cameraService.getOrderPhotos(this.order.number);
    this.includeOrderScreenshot = this.photos.some((photo) => photo.kind === 'screenshot');
    this.selectedPaths.clear();
    this.previewPhoto = undefined;
    this.cdr.detectChanges();
  }

  private selectedPhotos(): EzeeOrderPhoto[] {
    return this.photos.filter((photo) => this.selectedPaths.has(photo.path));
  }

  private selectedPhotosOrAll(): EzeeOrderPhoto[] {
    const selected = this.selectedPhotos();
    return selected.length ? selected : this.photos;
  }

  private async generateAndSaveOrderScreenshot(): Promise<EzeeOrderPhoto> {
    const downloaded = await this.ordersService.downloadOrderScreenshot(this.order.number);
    return this.cameraService.saveOrderScreenshot(this.order.number, downloaded.path);
  }
}
