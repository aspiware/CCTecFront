import { Injectable } from '@angular/core';
import { ApplicationSettings } from '@nativescript/core';
import { getBoolean, setBoolean } from '@nativescript/core/application-settings';
import { BehaviorSubject, Subject, timestamp } from 'rxjs';

interface ICoordinates {
  latitude: number;
  longitude: number;
}

interface ITap {
  coordinates?: ICoordinates;
  value?: number;
  port?: number;
  upstream?: number;
  downstream?: number;
  ingressSent?: boolean;
  scansSent?: boolean;
  imageName?: string;
  ingressTimestamp?: Date;
  scansTimestamp?: Date;
}

interface IGB {
  coordinates?: ICoordinates;
  upstream?: number;
  downstream?: number;
  ingressSent?: boolean;
  scansSent?: boolean;
  imageName?: string;
  ingressTimestamp?: Date;
  scansTimestamp?: Date;
}

interface JobLocations {
  tap?: ITap;
  gb?: IGB;
  surveySent?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  public urlBase: string =
    (globalThis as any).API_BASE_URL || "https://cctec.aspiware.com/v1";
  private readonly STORAGE_KEY = 'jobLocations';
  private readonly STARRED_KEY = 'starredJobs';
  private readonly LAST_CLEAN_DATE_KEY = 'lastCleanDate';
  private dataSubject = new Subject<any>();
  data$ = this.dataSubject.asObservable();
  private _isLoggedIn = new BehaviorSubject<boolean>(getBoolean("isLoggedIn", false));
  isLoggedIn$ = this._isLoggedIn.asObservable();

  login() {
    setBoolean("isLoggedIn", true);
    this._isLoggedIn.next(true);
  }

  logout() {
    ApplicationSettings.clear();
    this._isLoggedIn.next(false);
  }

  get isLoggedIn(): boolean {
    return getBoolean("isLoggedIn", false);
  }

  sendData(data: any) {
    this.dataSubject.next(data);
  }

  constructor() {
    this.checkAndClearDaily();
    // this.clearLocations();
  }

  public getUrlBase(): string {
    return this.urlBase;
  }

  // Verifica si es un nuevo día y limpia las locaciones si es necesario
  private checkAndClearDaily(): void {
    const lastCleanDate = ApplicationSettings.getString(this.LAST_CLEAN_DATE_KEY, '');
    const today = new Date().toDateString();

    if (lastCleanDate !== today) {
      this.clearLocations();
      this.clearStarredJobs();
      ApplicationSettings.setString(this.LAST_CLEAN_DATE_KEY, today);
    }
  }

  // Obtiene todas las ubicaciones almacenadas
  public getStoredLocations(): { [jobNumber: string]: JobLocations } {
    const stored = ApplicationSettings.getString(this.STORAGE_KEY, '{}');
    return JSON.parse(stored);
  }

  // Obtiene todas las ubicaciones almacenadas
  public getStoredJobs(): { [jobNumber: string]: JobLocations } {
    const storedJobs = ApplicationSettings.getString(this.STORAGE_KEY, '{}');
    return JSON.parse(storedJobs);
  }

  // Guarda las ubicaciones en ApplicationSettings
  private saveLocations(locations: { [jobNumber: string]: JobLocations }): void {
    ApplicationSettings.setString(this.STORAGE_KEY, JSON.stringify(locations));
  }

  // Establece las coordenadas para 'tap' de un trabajo específico
  public setTapLocation(jobNumber: string, latitude: number, longitude: number): void {
    const locations = this.getStoredLocations();

    if (!locations[jobNumber]) {
      locations[jobNumber] = {};
    }

    if (!locations[jobNumber].tap) {
      locations[jobNumber].tap = {};
    }

    console.log(locations[jobNumber])

    locations[jobNumber].tap.coordinates = { latitude, longitude };

    console.log(locations[jobNumber])
    this.saveLocations(locations);
  }

  // Obtiene las coordenadas de 'tap' de un trabajo específico
  public getTapLocation(jobNumber: string): ITap | undefined {
    return this.getStoredLocations()[jobNumber]?.tap;
  }

  // Establece las coordenadas para 'groundBlock' de un trabajo específico
  public setGroundBlockLocation(jobNumber: string, latitude: number, longitude: number): void {
    console.log('ENTRA A')
    const locations = this.getStoredLocations();

    if (!locations[jobNumber]) {
      locations[jobNumber] = {};
    }

    if (!locations[jobNumber].gb) {
      locations[jobNumber].gb = {};
    }

    locations[jobNumber].gb.coordinates = { latitude, longitude };
    console.log(locations[jobNumber])
    this.saveLocations(locations);
  }

  // Obtiene las coordenadas de 'groundBlock' de un trabajo específico
  public getGroundBlockLocation(jobNumber: string): IGB | undefined {
    return this.getStoredLocations()[jobNumber]?.gb;
  }

  // Nuevo: Devuelve las coordenadas (tap y groundBlock) de un jobNumber específico
  public getLocationsByJobNumber(jobNumber: string): JobLocations | undefined {
    return this.getStoredLocations()[jobNumber];
  }

  public setSurveySent(jobNumber: string): void {
    const locations = this.getStoredLocations();

    if (!locations[jobNumber]) {
      locations[jobNumber] = {};
    }

    locations[jobNumber].surveySent = true;
    this.saveLocations(locations);
  }

  public setScansSent(jobNumber: string, type: 'tap' | 'gb', upstream: number, downstream: number, tapValue?: number, tapPort?: number): void {
    const locations = this.getStoredLocations();

    if (!locations[jobNumber]) {
      locations[jobNumber] = {};
      locations[jobNumber].tap = {};
      locations[jobNumber].gb = {};
    }

    if (type == 'tap') {
      locations[jobNumber].tap.scansSent = true;
      locations[jobNumber].tap.value = tapValue;
      locations[jobNumber].tap.port = tapPort;
      locations[jobNumber].tap.upstream = upstream;
      locations[jobNumber].tap.downstream = downstream;
      locations[jobNumber].tap.scansTimestamp = new Date();
    } else {
      locations[jobNumber].gb.scansSent = true;
      locations[jobNumber].gb.upstream = upstream;
      locations[jobNumber].gb.downstream = downstream;
      locations[jobNumber].gb.scansTimestamp = new Date();
    }

    this.saveLocations(locations);
  }

  public setIngressSent(jobNumber: string, type: 'tap' | 'gb'): void {
    const locations = this.getStoredLocations();

    if (!locations[jobNumber]) {
      locations[jobNumber] = {};
    }

    if (type == 'tap') {
      locations[jobNumber].tap.ingressSent = true;
      locations[jobNumber].tap.ingressTimestamp = new Date();
    } else {
      locations[jobNumber].gb.ingressSent = true;
      locations[jobNumber].gb.ingressTimestamp = new Date();
    }

    this.saveLocations(locations);
  }

  public setXmPhotoName(jobNumber: string, type: 'tap' | 'gb', imageName: string): void {
    const locations = this.getStoredLocations();

    if (!locations[jobNumber]) {
      locations[jobNumber] = {};
    }

    if (type == 'tap') {
      locations[jobNumber].tap.imageName = imageName;
    } else {
      locations[jobNumber].gb.imageName = imageName;
    }

    this.saveLocations(locations);
  }

  public getSurveySent(jobNumber: string): boolean | undefined {
    const locations = this.getStoredLocations();

    return locations[jobNumber]?.surveySent;
  }

  public getStarredJobs(): { [jobNumber: string]: any } {
    const stored = ApplicationSettings.getString(this.STARRED_KEY, '{}');
    return JSON.parse(stored);
  }

  public isJobStarred(jobNumber: string): boolean {
    const entry = this.getStarredJobs()[jobNumber];
    return !!entry;
  }

  public setJobStarred(jobNumber: string, starred: boolean): void {
    const starredJobs = this.getStarredJobs();
    if (starred) {
      starredJobs[jobNumber] = true;
    } else {
      delete starredJobs[jobNumber];
    }
    ApplicationSettings.setString(this.STARRED_KEY, JSON.stringify(starredJobs));
  }

  public setStarredJob(job: any, starred: boolean): void {
    if (!job || job.number === undefined || job.number === null) {
      return;
    }
    const starredJobs = this.getStarredJobs();
    const key = String(job.number);
    if (starred) {
      starredJobs[key] = job;
    } else {
      delete starredJobs[key];
    }
    ApplicationSettings.setString(this.STARRED_KEY, JSON.stringify(starredJobs));
  }

  // Limpia todas las ubicaciones almacenadas
  public clearLocations(): void {
    ApplicationSettings.remove(this.STORAGE_KEY);
  }

  public clearStarredJobs(): void {
    ApplicationSettings.remove(this.STARRED_KEY);
  }
}
