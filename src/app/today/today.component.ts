import { ChangeDetectorRef, Component, NO_ERRORS_SCHEMA, OnInit, ViewContainerRef } from '@angular/core';
import { ModalDialogService, NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular';
import { Application, ObservableArray, Screen, Utils } from '@nativescript/core';
import { NativeScriptUIListViewModule } from 'nativescript-ui-listview/angular';
import { MenuEvent } from '~/app/shared/components/menu-button/common';
import { Item } from '~/app/shared/components/menu-button/item';
import { UserModel } from '../shared/models/user.model';
import { UsersService } from '../shared/services/users.service';
import { TodayService } from './today.service';
import { concat, map } from 'rxjs';
import { ConfigService } from '../shared/services/config.service';
import { Router } from '@angular/router';
import { WifiConfigComponent } from '../wifi-config/wifi-config.component';
import { TodayJobsCountService } from '../shared/services/today-jobs-count.service';
import { CustomerInfoComponent } from '../customer-info/customer-info.component';
import { EditJobComponent } from '../edit-job/edit-job.component';

@Component({
  standalone: true,
  selector: 'app-today',
  imports: [NativeScriptCommonModule, NativeScriptUIListViewModule],
  schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './today.component.html',
  styleUrl: './today.component.scss',
})
export class TodayComponent implements OnInit {
  private readonly demoJobs: any[] = [
    {
        "id": 12648,
        "jobTypeId": 5,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "TECH RECOVERY",
        "address": "2001 BURKE RD APT 36",
        "city": "PASADENA",
        "state": "TX",
        "zipcode": "775023019",
        "number": "601048",
        "accountNumber": "8777701843015816",
        "workOrderNumber": "10018331781220170001",
        "amount": "52.33",
        "description": "",
        "jobUnits": "20",
        "modems": "1",
        "tvBoxes": "0",
        "cameras": "0",
        "timeSlotStartDateTime": "2026-02-24T09:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T11:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 0,
        "devices": [
            {
                "id": 28688,
                "type": "MTA",
                "lob": "HSI",
                "name": "MTA",
                "serialNumber": "8C6A8DFA23FE",
                "mac": "8C:6A:8D:FA:23:FE",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            }
        ],
        "customer": {
            "id": 9821,
            "firstName": "SHAI",
            "lastName": "SMITH",
            "callFirstPhoneNumber": "3464535807",
            "homePhoneNumber": "3464559228",
            "workPhoneNumber": null,
            "surveyPhoneNumber": "3464559228",
            "xfinityAppUsername": "sourthennsweetstrawberry",
            "email": "SOURTHENNSWEETSTRAWBERRY@GMAIL.COM"
        },
        "customJob": null,
        "createdAt": "2026-02-24T14:54:12.000Z"
    },
    {
        "id": 12650,
        "jobTypeId": 5,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "TECH RECOVERY",
        "address": "5218 ALLENDALE RD",
        "city": "HOUSTON",
        "state": "TX",
        "zipcode": "770176011",
        "number": "601283",
        "accountNumber": "8777703352924008",
        "workOrderNumber": "10018331991720170001",
        "amount": "52.33",
        "description": "",
        "jobUnits": "20",
        "modems": "1",
        "tvBoxes": "0",
        "cameras": "0",
        "timeSlotStartDateTime": "2026-02-24T09:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T11:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 0,
        "devices": [
            {
                "id": 28690,
                "type": "MTA",
                "lob": "HSI",
                "name": "MTA",
                "serialNumber": "0CFE7BF34D94",
                "mac": "0C:FE:7B:F3:4D:94",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            }
        ],
        "customer": {
            "id": 9823,
            "firstName": "CRISPIN JR",
            "lastName": "ELIAS",
            "callFirstPhoneNumber": "8328206255",
            "homePhoneNumber": "8328206255",
            "workPhoneNumber": null,
            "surveyPhoneNumber": "8328206255",
            "xfinityAppUsername": "ecrjr_eli23",
            "email": null
        },
        "customJob": null,
        "createdAt": "2026-02-24T16:09:27.000Z"
    },
    {
        "id": 12652,
        "jobTypeId": 6,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "VID UP",
        "address": "4222 BLUE WATER CT",
        "city": "PASADENA",
        "state": "TX",
        "zipcode": "775053870",
        "number": "602946",
        "accountNumber": "8777701842197334",
        "workOrderNumber": "10018333315120130001",
        "amount": "44.99",
        "description": "Upgrade",
        "jobUnits": "24",
        "modems": "1",
        "tvBoxes": "3",
        "cameras": "0",
        "timeSlotStartDateTime": "2026-02-24T10:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T12:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 1,
        "devices": [
            {
                "id": 28692,
                "type": "IPSTB",
                "lob": "VIDEO",
                "name": "Living Room 3",
                "serialNumber": "TM00931Q1443",
                "mac": null,
                "connectionStatus": true,
                "wasChangedUpgrade": 1
            },
            {
                "id": 28693,
                "type": "IPSTB",
                "lob": "VIDEO",
                "name": "IPSTB",
                "serialNumber": "PAM610408104",
                "mac": null,
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28694,
                "type": "STB",
                "lob": "UNKNOWN",
                "name": "Living Room 2",
                "serialNumber": "MA1947PG4024",
                "mac": "60:D2:48:80:E4:65",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28695,
                "type": "MTA",
                "lob": "HSI",
                "name": "MTA",
                "serialNumber": "F8D00E6945F4",
                "mac": "F8:D0:0E:69:45:F4",
                "connectionStatus": true,
                "wasChangedUpgrade": 1
            }
        ],
        "customer": {
            "id": 9825,
            "firstName": "LINDA",
            "lastName": "HAMMONS",
            "callFirstPhoneNumber": null,
            "homePhoneNumber": "2817932585",
            "workPhoneNumber": null,
            "surveyPhoneNumber": "2818440552",
            "xfinityAppUsername": "lshammons",
            "email": "LSHAMMONS@GMAIL.COM"
        },
        "customJob": null,
        "createdAt": "2026-02-24T17:46:31.000Z"
    },
    {
        "id": 12658,
        "jobTypeId": 2,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "HSD RC",
        "address": "2111 COLONIAL DR",
        "city": "BAYTOWN",
        "state": "TX",
        "zipcode": "775203791",
        "number": "598486",
        "accountNumber": "8777701042132289",
        "workOrderNumber": "10018328745420150001",
        "amount": "62.72",
        "description": "Double Play Install",
        "jobUnits": "27",
        "modems": "2",
        "tvBoxes": "2",
        "cameras": "0",
        "timeSlotStartDateTime": "2026-02-24T13:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T15:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 0,
        "devices": [
            {
                "id": 28710,
                "type": "MTA",
                "lob": "HSI",
                "name": "MTA",
                "serialNumber": "F8D00E4859F4",
                "mac": "F8:D0:0E:48:59:F4",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28711,
                "type": "IPSTB",
                "lob": "VIDEO",
                "name": "IPSTB",
                "serialNumber": "TM02651G4714",
                "mac": null,
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28712,
                "type": "STB",
                "lob": "VIDEO",
                "name": "STB",
                "serialNumber": "PAK810284123",
                "mac": "44:34:A7:95:9D:C5",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28713,
                "type": "MTA",
                "lob": "UNKNOWN",
                "name": "MTA",
                "serialNumber": "C09435BAB782",
                "mac": "C0:94:35:BA:B7:82",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            }
        ],
        "customer": {
            "id": 9831,
            "firstName": "ADRIANNA",
            "lastName": "PHILLIPS",
            "callFirstPhoneNumber": "8325424697",
            "homePhoneNumber": "8325424697",
            "workPhoneNumber": null,
            "surveyPhoneNumber": "8325424697",
            "xfinityAppUsername": "ADRIANNNAPHILLIPS",
            "email": "ADRIANNNAPHILLIPS@GMAIL.COM"
        },
        "customJob": null,
        "createdAt": "2026-02-24T19:50:47.000Z"
    },
    {
        "id": 12659,
        "jobTypeId": 5,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "TECH RECOVERY",
        "address": "3201 GARTH RD APT 54",
        "city": "BAYTOWN",
        "state": "TX",
        "zipcode": "775213831",
        "number": "602679",
        "accountNumber": "8777701042132651",
        "workOrderNumber": "10018333134220170001",
        "amount": "52.33",
        "description": "",
        "jobUnits": "20",
        "modems": "2",
        "tvBoxes": "0",
        "cameras": "0",
        "timeSlotStartDateTime": "2026-02-24T15:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T17:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 0,
        "devices": [
            {
                "id": 28714,
                "type": "MTA",
                "lob": "UNKNOWN",
                "name": "MTA",
                "serialNumber": "989D5D7803E2",
                "mac": "98:9D:5D:78:03:E2",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28715,
                "type": "MTA",
                "lob": "HSI",
                "name": "MTA",
                "serialNumber": "A8705DFE1AE9",
                "mac": "A8:70:5D:FE:1A:E9",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            }
        ],
        "customer": {
            "id": 9832,
            "firstName": "LOUIS",
            "lastName": "CAMARILLO",
            "callFirstPhoneNumber": "8329386831",
            "homePhoneNumber": "8329386831",
            "workPhoneNumber": null,
            "surveyPhoneNumber": "8329386831",
            "xfinityAppUsername": "lcamarillo35",
            "email": "LCAMARILLO35@YAHOO.COM"
        },
        "customJob": null,
        "createdAt": "2026-02-24T20:39:49.000Z"
    },
    {
        "id": 12656,
        "jobTypeId": 5,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "TECH RECOVERY",
        "address": "2629 1/2 W MAIN ST",
        "city": "BAYTOWN",
        "state": "TX",
        "zipcode": "775206218",
        "number": "603567",
        "accountNumber": "8777701042132768",
        "workOrderNumber": "10018334592820190001",
        "amount": "52.33",
        "description": "",
        "jobUnits": "20",
        "modems": "1",
        "tvBoxes": "0",
        "cameras": "0",
        "timeSlotStartDateTime": "2026-02-24T13:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T15:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 0,
        "devices": [
            {
                "id": 28707,
                "type": "CM",
                "lob": "HSI",
                "name": "CM",
                "serialNumber": "FC51A46DA559",
                "mac": "FC:51:A4:6D:A5:59",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            }
        ],
        "customer": {
            "id": 9829,
            "firstName": "LAMARQUI",
            "lastName": "LUCKETT",
            "callFirstPhoneNumber": "3469778335",
            "homePhoneNumber": "3469778335",
            "workPhoneNumber": null,
            "surveyPhoneNumber": null,
            "xfinityAppUsername": null,
            "email": "NO@EMAIL.COM"
        },
        "customJob": null,
        "createdAt": "2026-02-24T18:57:15.000Z"
    },
    {
        "id": 12674,
        "jobTypeId": 4,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "HSD OUT",
        "address": "4503 ESTATE DR",
        "city": "BAYTOWN",
        "state": "TX",
        "zipcode": "775211881",
        "number": "601959",
        "accountNumber": "8777701041483048",
        "workOrderNumber": "10018332542220120001",
        "amount": "36.65",
        "description": "Trouble Call",
        "jobUnits": "17",
        "modems": "2",
        "tvBoxes": "0",
        "cameras": "4",
        "timeSlotStartDateTime": "2026-02-24T15:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T17:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 0,
        "devices": [
            {
                "id": 28742,
                "type": "MTA",
                "lob": "HSI",
                "name": "MTA",
                "serialNumber": "60D248161057",
                "mac": "60:D2:48:16:10:57",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28743,
                "type": "MTA",
                "lob": "UNKNOWN",
                "name": "MTA",
                "serialNumber": "48BDCE19803F",
                "mac": "48:BD:CE:19:80:3F",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28744,
                "type": "CAMERA",
                "lob": "UNKNOWN",
                "name": "Gate side",
                "serialNumber": "C22114019166",
                "mac": "88:C9:B3:E7:0D:41",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28745,
                "type": "UNKNOWN",
                "lob": "XH",
                "name": "Touch Screen",
                "serialNumber": "T22013002473",
                "mac": "NA",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28746,
                "type": "CAMERA",
                "lob": "UNKNOWN",
                "name": "Backyard",
                "serialNumber": "C22017014240",
                "mac": "E4:26:86:F9:FF:8B",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28747,
                "type": "CAMERA",
                "lob": "UNKNOWN",
                "name": "Front",
                "serialNumber": "C22017014318",
                "mac": "E4:26:86:F9:FF:D9",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            },
            {
                "id": 28748,
                "type": "CAMERA",
                "lob": "UNKNOWN",
                "name": "Side",
                "serialNumber": "C22041007683",
                "mac": "7C:8F:DE:FE:D9:CA",
                "connectionStatus": false,
                "wasChangedUpgrade": 0
            }
        ],
        "customer": {
            "id": 9847,
            "firstName": "ADRIAN",
            "lastName": "OLEARY",
            "callFirstPhoneNumber": "8329759128",
            "homePhoneNumber": "8329759128",
            "workPhoneNumber": null,
            "surveyPhoneNumber": "8329759128",
            "xfinityAppUsername": "adrianaitor97",
            "email": "VALERIA_G20@YAHOO.COM"
        },
        "customJob": null,
        "createdAt": "2026-02-24T21:17:17.000Z"
    },
    {
        "id": 12677,
        "jobTypeId": 5,
        "sms_survey_sent": 0,
        "notes": null,
        "jobDescription": "TECH RECOVERY",
        "address": "347 BREEZE PARK DR",
        "city": "HOUSTON",
        "state": "TX",
        "zipcode": "770152107",
        "number": "604412",
        "accountNumber": "8777702052244162",
        "workOrderNumber": "10018335320620160001",
        "amount": "52.33",
        "description": "",
        "jobUnits": "20",
        "modems": "1",
        "tvBoxes": "0",
        "cameras": "0",
        "timeSlotStartDateTime": "2026-02-24T08:00:00-06:00",
        "timeSlotEndDateTime": "2026-02-24T20:00:00-06:00",
        "status": "CLOSED",
        "isCurrent": 0,
        "isUpgrade": 0,
        "devices": [
            {
                "id": 28752,
                "type": "CM",
                "lob": "HSI",
                "name": "CM",
                "serialNumber": "100C6B6859F8",
                "mac": "10:0C:6B:68:59:F8",
                "connectionStatus": true,
                "wasChangedUpgrade": 0
            }
        ],
        "customer": {
            "id": 9850,
            "firstName": "MICHAEL",
            "lastName": "HERNANDEZ",
            "callFirstPhoneNumber": null,
            "homePhoneNumber": "8327713996",
            "workPhoneNumber": null,
            "surveyPhoneNumber": "8327713996",
            "xfinityAppUsername": "mh53101",
            "email": "MH53101@GMAIL.COM"
        },
        "customJob": null,
        "createdAt": "2026-02-25T00:36:44.000Z"
    }
];

  public user: UserModel;
  public jobList: ObservableArray<any>;
  public originalJobList: ObservableArray<any>;
  public starredJobList: ObservableArray<any>;
  public todayTotal = 0;
  public units = 0;
  public weeklyTotal = 0;
  public starredCount = 0;
  public mainMenuIconName = 'ellipsis.circle';
  public item: any;
  scansMenu: Item =
    {
      name: 'Scans',
      options: [
        { name: 'Ingress Scans', icon: 'waveform.path' },
        { name: 'PHT Scans', icon: 'chart.bar.xaxis' },
        { name: 'Bonding Validation', icon: 'tag' },
        { name: 'XM Photo', icon: 'photo.fill' },
        {
          name: 'End of Day', icon: 'circle.slash.fill', destructive: true, confirm: {
            title: 'Do you want to log off for the day?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        }
      ],
    };
  jobMenu: Item =
    {
      name: 'Job Menu',
      options: [
        { name: 'Go Enroute', icon: 'car.fill' },
        { name: 'Go On Job', icon: 'wrench.fill' },
        { name: 'Complete Job', icon: 'checkmark.circle.fill' },
        // { name: 'Set ETC', icon: 'clock.fill' },
        { name: 'Set Location', icon: 'mappin.and.ellipse' },
      ],
    };
  mainMenu: Item =
    {
      name: 'Main Menu',
      options: [
        { name: 'Available', icon: 'checkmark.circle.fill' },
        { name: 'Lunch', icon: 'fork.knife.circle.fill' },
        { name: 'Tech Log', icon: 'network' },
        { name: 'Meeting', icon: 'inset.filled.rectangle.and.person.filled' },
        { name: 'Logged On', icon: 'iphone.and.arrow.right.outward' },
        {
          name: 'End of Day', icon: 'circle.slash.fill', destructive: true, confirm: {
            title: 'Do you want to log off for the day?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };
  mainMenuR: Item =
    {
      name: 'Main Menu Right',
      options: [
        { name: 'Location', icon: 'mappin.and.ellipse' },
        { name: 'Gate Codes', icon: 'square.grid.3x3' },
        { name: 'Customer Consent', icon: 'signature' },
        { name: 'Report Bug', icon: 'bubble.left.and.exclamationmark.bubble.right' },
        {
          name: 'Log Out', icon: 'person.crop.circle.badge.xmark', destructive: true, confirm: {
            title: 'Are you sure you want to log out?',        // texto del submenú
            confirmText: 'Yes',  // botón final (rojo)
            cancelText: 'Cancel',
            presentation: 'anchor'
          }
        },
      ],
    };
  public isSyncing = false;
  public isOnShift: boolean;
  public techStatus: boolean;
  public isTechStatusLoading = false;
  public lastKnownTechStatus = 'AVAIL';
  showStarred = false;
  private isCopyMenuOpen = false;
  private lastCopyMenuTs = 0;
  private messageComposeDelegate: any;
  private actionTapStates: { [key: string]: boolean } = {};
  private actionTapTimers: { [key: string]: ReturnType<typeof setTimeout> } = {};

  constructor(
    private usersService: UsersService,
    private todayService: TodayService,
    private configService: ConfigService,
    private todayJobsCountService: TodayJobsCountService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private routerExtensions: RouterExtensions,
    private modalService: ModalDialogService,
    private vcRef: ViewContainerRef
  ) { }

  ngOnInit(): void {
    this.jobList = new ObservableArray([]);
    this.user = this.usersService.getUser() || { userId: 15 };
    this.mainMenuIconName = 'questionmark';

    if (this.isDemoUser()) {
      this.applyJobsForDisplay(this.demoJobs.map((job) => ({ ...job })));
      this.weeklyTotal = this.todayTotal;
      this.cdr.detectChanges();
      return;
    }

    this.getWorkOrders();
  }

  public getWorkOrders(onFinished?: () => void): void {
    if (this.isSyncing) {
      onFinished?.();
      return;
    }

    this.isSyncing = true;
    this.cdr.detectChanges();

    const userId = this.user?.userId || 0;

    this.hasLunch();
    this.getTechStatus();

    const workOrders$ = this.todayService.getWorkOrders(userId).pipe(
      map((res) =>
        res.map((job) => {
          const surveySent = this.configService.getSurveySent(job.number);

          const isStarred = this.configService.isJobStarred(job.number);
          if (isStarred) {
            this.configService.setStarredJob(job, true);
          }
          return {
            ...job,
            sms_survey_sent: surveySent ? true : false,
            isStarred,
          };
        })
      ),
      map((jobs) => ({ kind: 'workOrders' as const, payload: jobs }))
    );

    const weeklyTotal$ = this.todayService
      .getTotalCurrentWeek(userId)
      .pipe(map((weekly) => ({ kind: 'weeklyTotal' as const, payload: weekly })));

    concat(workOrders$, weeklyTotal$).subscribe({
      next: (result) => {
        switch (result.kind) {
          case 'workOrders':
            this.applyJobsForDisplay(result.payload);
            break;
          case 'weeklyTotal':
            this.weeklyTotal = Number(result.payload?.total || result.payload || 0);
            break;
          default:
            break;
        }
      },
      complete: () => {
        this.isSyncing = false;
        onFinished?.();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log(error);
        this.todayJobsCountService.setCount(0);
        this.isSyncing = false;
        onFinished?.();
        this.cdr.detectChanges();
      },
    });

        // new Toasty({ text: error })
        //   .setToastDuration(ToastDuration.LONG)
        //   .setToastPosition(ToastPosition.TOP)
        //   .setTextColor(new Color("white"))
        //   .setBackgroundColor(new Color("gray"))
        //   .show();
    // this.todayService.findTodayByUser(userId).subscribe({
    //   next: (res) => {
    //     console.log(res.jobs);

    //     const jobs = Array.isArray(res?.jobs) ? res.jobs : (Array.isArray(res) ? res : []);
    //     this.jobList = new ObservableArray(jobs);
    //     this.todayTotal = jobs
    //       .filter((job) => job?.status === 'CLOSED')
    //       .reduce((total, job) => total + Number(job?.amount || 0), 0);
    //     this.units = jobs.reduce((total, job) => total + Number(job?.jobUnits || 0), 0);
    //     onDone();
    //   },
    //   error: () => onDone(),
    // });

  }

  private isDemoUser(): boolean {
    const rawUser = this.user as any;
    const username = String(rawUser?.username || rawUser?.bp || rawUser?.name || '').trim().toLowerCase();
    return username === 'demo';
  }

  private applyJobsForDisplay(jobs: any[]): void {
    const displayJobs = (Array.isArray(jobs) ? jobs : []).map((job) => {
      const surveySent = this.configService.getSurveySent(job.number);
      const isStarred = this.configService.isJobStarred(job.number);
      if (isStarred) {
        this.configService.setStarredJob(job, true);
      }
      return {
        ...job,
        sms_survey_sent: surveySent ? true : false,
        isStarred,
      };
    });

    this.originalJobList = new ObservableArray(displayJobs);
    this.todayJobsCountService.setCount(this.originalJobList.length);
    if (!this.starredJobList) {
      this.starredJobList = new ObservableArray([]);
    }

    this.rebuildStarredList();
    this.jobList.splice(0);
    const listToShow = this.showStarred ? this.starredJobList : this.originalJobList;
    this.jobList.push(...listToShow);

    this.todayTotal = displayJobs
      .filter((job) => job?.status === 'CLOSED')
      .reduce((total, job) => total + Number(job?.amount || 0), 0);
    this.units = displayJobs.reduce((total, job) => total + Number(job?.jobUnits || 0), 0);
  }

  private rebuildStarredList() {
    if (!this.starredJobList) {
      this.starredJobList = new ObservableArray([]);
    }

    this.starredJobList.splice(0);
    const starredMap = this.configService.getStarredJobs();
    const starredJobs: any[] = [];

    Object.keys(starredMap || {}).forEach((key) => {
      const stored = starredMap[key];
      const latest = this.originalJobList?.find((job) => String(job.number) === String(key));

      if (latest) {
        latest.isStarred = true;
        starredJobs.push(latest);
        this.configService.setStarredJob(latest, true);
        return;
      }

      if (stored && stored !== true) {
        stored.isStarred = true;
        starredJobs.push(stored);
      }
    });

    if (starredJobs.length) {
      this.starredJobList.push(...starredJobs);
    }

    this.starredCount = this.starredJobList.length;
  }

  toggleStarredView(event: any) {
    this.showStarred = !!event?.object?.checked;
    this.rebuildStarredList();

    if (!this.jobList) {
      this.jobList = new ObservableArray([]);
    }

    this.jobList.splice(0);
    const listToShow = this.showStarred ? this.starredJobList : this.originalJobList;
    listToShow && this.jobList.push(...listToShow);
  }

  setStarred(item: any) {
    if (!item) {
      return;
    }
    item.isStarred = !item.isStarred;
    if (item.number !== undefined && item.number !== null) {
      this.configService.setStarredJob(item, item.isStarred);
    }
    this.rebuildStarredList();
    if (this.showStarred) {
      this.jobList.splice(0);
      this.jobList.push(...this.starredJobList);
    }
  }

  public markJobActionTap(item: any, action: string, autoClearMs = 140): void {
    const key = `${item?.number || 'unknown'}:${action}`;
    this.actionTapStates[key] = true;
    this.cdr.detectChanges();

    if (this.actionTapTimers[key]) {
      clearTimeout(this.actionTapTimers[key]);
    }

    if (autoClearMs > 0) {
      this.actionTapTimers[key] = setTimeout(() => {
        this.actionTapStates[key] = false;
        this.cdr.detectChanges();
      }, autoClearMs);
    }
  }

  public isJobActionTapped(item: any, action: string): boolean {
    const key = `${item?.number || 'unknown'}:${action}`;
    return !!this.actionTapStates[key];
  }

  public clearJobActionTap(item: any, action: string): void {
    const key = `${item?.number || 'unknown'}:${action}`;
    if (this.actionTapTimers[key]) {
      clearTimeout(this.actionTapTimers[key]);
      delete this.actionTapTimers[key];
    }
    this.actionTapStates[key] = false;
    this.cdr.detectChanges();
  }

  public onSelectedMainMenuR(event: MenuEvent): void {
    console.log('[Today] mainMenuR selected', event?.index);

    switch (event?.index) {
      case 2:
        this.router.navigate(['/tabs', { outlets: { todayListTab: ['customer-consent'] } }]);
        break;
      case 4:
        this.configService.logout();
        this.todayJobsCountService.setCount(0);
        this.routerExtensions.navigate(['/login'], { clearHistory: true });
        break;
      default:
        break;
    }
  }

  public onSelectedMainMenu(event: MenuEvent): void {
    const selected = this.mainMenu?.options?.[event?.index || 0];
    switch (event?.index) {
      case 0:
        this.updateTechStatusMenu('AVAIL', 'AVAIL', selected?.icon);
        break;
      case 1:
        this.updateTechStatusMenu('LUNCH', 'AVAIL', selected?.icon);
        break;
      case 2:
        this.updateTechStatusMenu('TLOGISTICS', 'AVAIL', selected?.icon);
        break;
      case 3:
        this.updateTechStatusMenu('MEETING', 'AVAIL', selected?.icon);
        break;
      case 4:
        this.updateTechStatusMenu('LON', 'AVAIL', selected?.icon);
        break;
      case 5:
        this.updateTechStatusMenu('EOD', 'AVAIL', selected?.icon);
        break;
    }
  }

  public selected(event: MenuEvent, item?: any): void {
    console.log('[Today] selected', event?.index, item);
  }

  public onPullToRefresh(event: any): void {
    const listView = event?.object;
    if (this.isSyncing) {
      listView?.notifyPullToRefreshFinished?.();
      return;
    }
    this.getWorkOrders(() => {
      listView?.notifyPullToRefreshFinished?.();
      listView?.scrollToIndex?.(0, false);

    });
  }

  public onItemTap(event: any): void {
    const tappedItem = this.jobList?.getItem?.(event?.index);
    console.log('[Today] item tap', tappedItem?.number);
  }

  public wifiConfig(job: any): void {
    if (!job) {
      return;
    }

    const modalWidth = Math.min(380, Math.max(300, Screen.mainScreen.widthDIPs - 32));
    const modalHeight = Math.min(620, Math.max(420, Screen.mainScreen.heightDIPs - 120));

    const options: any = {
      context: job,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
        // width: modalWidth,
        // height: modalHeight,
      },
    };

    this.modalService.showModal(WifiConfigComponent, options).then((result) => {
      this.clearJobActionTap(job, 'wifi');

      if (!result) {
        return;
      }

      if (!__IOS__) {
        return;
      }

      if (typeof MFMessageComposeViewController === 'undefined' || !MFMessageComposeViewController.canSendText()) {
        return;
      }

      const recipients = Array.isArray(result?.numbers)
        ? result.numbers.filter((n: any) => !!n).map((n: any) => String(n))
        : [];
      const body = String(result?.wifiData || '');
      // Wait one run-loop so Wifi modal is fully dismissed before presenting SMS composer.
      setTimeout(() => this.presentSmsComposer(recipients, body), 150);
    });
  }

  public showCustomerInfo(job: any): void {
    if (!job) {
      return;
    }

    const modalWidth = Math.min(380, Math.max(300, Screen.mainScreen.widthDIPs - 32));
    const modalHeight = Math.min(620, Math.max(420, Screen.mainScreen.heightDIPs - 120));

    const options: any = {
      context: job,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
        // width: modalWidth,
        // height: modalHeight,
      },
    };

    this.modalService.showModal(CustomerInfoComponent, options).then(() => {
      this.clearJobActionTap(job, 'customer');
    });
  }

  public showEditJob(job: any): void {
    if (!job) {
      return;
    }

    const options: any = {
      context: job,
      viewContainerRef: this.vcRef,
      animated: true,
      fullscreen: false,
      stretched: false,
      cancelable: true,
      dismissEnabled: true,
      ios: {
        presentationStyle: UIModalPresentationStyle.Custom,
      },
    };

    this.modalService.showModal(EditJobComponent, options).then(() => {
      this.clearJobActionTap(job, 'edit');
    });
  }

  private presentSmsComposer(recipients: string[], body: string): void {
    const controller = MFMessageComposeViewController.new();
    const MessageComposeDelegate = (NSObject as any).extend(
      {
        messageComposeViewControllerDidFinishWithResult: (
          msgController: MFMessageComposeViewController,
          _msgResult: MessageComposeResult
        ) => {
          msgController.dismissViewControllerAnimatedCompletion(true, null);
          this.messageComposeDelegate = null;
        },
      },
      {
        protocols: [MFMessageComposeViewControllerDelegate],
      }
    );

    this.messageComposeDelegate = MessageComposeDelegate.new();
    controller.body = body;
    controller.recipients = recipients as any;
    controller.messageComposeDelegate = this.messageComposeDelegate;
    (controller as any).__delegate = this.messageComposeDelegate;

    const root = Application.ios?.rootController;
    let presenter = root as UIViewController;
    while (presenter?.presentedViewController) {
      presenter = presenter.presentedViewController;
    }
    presenter?.presentViewControllerAnimatedCompletion(controller, true, null);
  }

  public itemStatusIcon(item: any): string {
    if (item?.status === 'CLOSED') {
      return '\uf058';
    }
    if (item?.status === 'OPEN' && item?.isCurrent) {
      return '\uf017';
    }
    if (item?.status === 'OPEN') {
      return '\uf49e';
    }
    return '\uf111';
  }

  public itemStatusClass(item: any): string {
    if (item?.status === 'CLOSED') {
      return 'status-closed';
    }
    if (item?.status === 'OPEN' && item?.isCurrent) {
      return 'status-current';
    }
    if (item?.status === 'OPEN') {
      return 'status-open';
    }
    return 'status-default';
  }

  public fiveDigitZip(zipcode: any): string {
    const zip = String(zipcode || '').trim();
    if (zip.includes('-')) {
      return zip.split('-')[0];
    }
    return zip.slice(0, 5);
  }

  private hasLunch(): void {
    const userId = this.user?.userId || 0;
    this.todayService.hasLunch(userId).subscribe({
      next: (res) => {
        this.isOnShift = !!(res?.hasLunch ?? res);
        this.cdr.detectChanges();
      },
      error: () => {
        this.isOnShift = false;
        this.cdr.detectChanges();
      },
    });
  }

  private getTechStatus(): void {
    const userId = this.user?.userId || 0;

    if (this.isTechStatusLoading) {
      return;
    }

    setTimeout(() => {
      this.isTechStatusLoading = true;
    })

    this.todayService.getTechStatus(userId).subscribe({
      next: (res) => {
        console.log('TECH_STATUS', res);

        const status = String(res?.data?.techStatus || '').toUpperCase();

        if (!status) {
          return;
        }

        this.lastKnownTechStatus = status;
        this.isTechStatusLoading = false;

        switch (status) {
          case 'AVAIL':
            this.mainMenuIconName = this.mainMenu.options[0]?.icon || this.mainMenuIconName;
            break;
          case 'LUNCH':
            this.mainMenuIconName = this.mainMenu.options[1]?.icon || this.mainMenuIconName;
            break;
          case 'TLOGISTICS':
            this.mainMenuIconName = this.mainMenu.options[2]?.icon || this.mainMenuIconName;
            break;
          case 'MEETING':
            this.mainMenuIconName = this.mainMenu.options[3]?.icon || this.mainMenuIconName;
            break;
          case 'LON':
            this.mainMenuIconName = this.mainMenu.options[4]?.icon || this.mainMenuIconName;
            break;
          case 'LOFF':
            this.mainMenuIconName = this.mainMenu.options[5]?.icon || this.mainMenuIconName;
            break;
          case 'ENROUTE':
            this.mainMenuIconName = 'car';
            break;
          case 'ONJOB':
            this.mainMenuIconName = 'wrench.adjustable.fill';
            break;
          case 'WRAPUP':
            this.mainMenuIconName = 'flag.fill';
            break;
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.log(e)
        this.isTechStatusLoading = false;
      },
    });
  }

  private updateTechStatusMenu(
    techStatus: string,
    lastKnownTechStatus: string = 'AVAIL',
    selectedIcon?: string
  ): void {
    if (this.isTechStatusLoading) {
      return;
    }

    const userId = this.user?.userId || 0;
    this.isTechStatusLoading = true;
    this.cdr.detectChanges();

    this.todayService.updateTechStatusMenu(userId, techStatus, lastKnownTechStatus).subscribe({
      next: () => {
        this.lastKnownTechStatus = techStatus;

        if (selectedIcon) {
          this.mainMenuIconName = selectedIcon;
        }

        this.isTechStatusLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isTechStatusLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  getFiveDigitZipCode(zip: string): string {
    return zip.substring(0, 5);
  }

  public showMenu(args: any, value: any, type?: string): void {
    if (args && typeof args.cancel === 'boolean') {
      args.cancel = true;
    }

    const now = Date.now();
    if (this.isCopyMenuOpen || now - this.lastCopyMenuTs < 500) {
      return;
    }

    const textToCopy = String(value ?? '').trim();
    if (!textToCopy) {
      return;
    }

    if (__IOS__) {
      this.isCopyMenuOpen = true;
      this.lastCopyMenuTs = now;

      let viewController = Application.ios?.rootController;
      while (
        viewController &&
        viewController.presentedViewController &&
        !viewController.presentedViewController.beingDismissed
      ) {
        viewController = viewController.presentedViewController;
      }
      if (!viewController?.view) {
        this.isCopyMenuOpen = false;
        return;
      }

      const sourceView = args?.object?.ios as UIView | undefined;
      const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
        type === 'address' ? 'Address' : 'Copy',
        textToCopy,
        UIAlertControllerStyle.ActionSheet
      );

      const copyAction = UIAlertAction.actionWithTitleStyleHandler(
        'Copy',
        UIAlertActionStyle.Default,
        () => {
          UIPasteboard.generalPasteboard.string = textToCopy;
          this.isCopyMenuOpen = false;
        }
      );
      copyAction.setValueForKey(UIImage.systemImageNamed('doc.on.doc'), 'image');
      alert.addAction(copyAction);

      if (type === 'address') {
        const goAction = UIAlertAction.actionWithTitleStyleHandler(
          'Go',
          UIAlertActionStyle.Default,
          () => {
            this.isCopyMenuOpen = false;
            this.showMapOptions(sourceView, textToCopy);
          }
        );
        goAction.setValueForKey(UIImage.systemImageNamed('location'), 'image');
        alert.addAction(goAction);
      }

      alert.addAction(
        UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, () => {
          this.isCopyMenuOpen = false;
        })
      );

      const popover = alert.popoverPresentationController;
      if (popover) {
        popover.sourceView = sourceView || viewController.view;
        popover.sourceRect = sourceView
          ? sourceView.bounds
          : CGRectMake(
            viewController.view.bounds.size.width / 2,
            viewController.view.bounds.size.height / 2,
            1,
            1
          );
        popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
      }

      viewController.presentViewControllerAnimatedCompletion(alert, true, null);
      return;
    }
  }

  private showMapOptions(sourceView: UIView | undefined, address: string): void {
    if (!__IOS__) {
      return;
    }

    let viewController = Application.ios?.rootController;
    while (
      viewController &&
      viewController.presentedViewController &&
      !viewController.presentedViewController.beingDismissed
    ) {
      viewController = viewController.presentedViewController;
    }
    if (!viewController?.view) {
      return;
    }

    const alert = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
      'Open With',
      address,
      UIAlertControllerStyle.ActionSheet
    );

    const appleAction = UIAlertAction.actionWithTitleStyleHandler(
      'iOS Map',
      UIAlertActionStyle.Default,
      () => {
        const query = encodeURIComponent(address);
        Utils.openUrl(`http://maps.apple.com/?q=${query}`);
      }
    );
    appleAction.setValueForKey(UIImage.systemImageNamed('map'), 'image');
    alert.addAction(appleAction);

    const googleAction = UIAlertAction.actionWithTitleStyleHandler(
      'Google Map',
      UIAlertActionStyle.Default,
      () => {
        const query = encodeURIComponent(address);
        const googleAppUrl = `comgooglemaps://?q=${query}`;
        const googleWebUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
        const opened = Utils.openUrl(googleAppUrl);
        if (!opened) {
          Utils.openUrl(googleWebUrl);
        }
      }
    );
    googleAction.setValueForKey(UIImage.systemImageNamed('globe'), 'image');
    alert.addAction(googleAction);

    alert.addAction(
      UIAlertAction.actionWithTitleStyleHandler('Cancel', UIAlertActionStyle.Cancel, null)
    );

    const popover = alert.popoverPresentationController;
    if (popover) {
      popover.sourceView = sourceView || viewController.view;
      popover.sourceRect = sourceView
        ? sourceView.bounds
        : CGRectMake(
          viewController.view.bounds.size.width / 2,
          viewController.view.bounds.size.height / 2,
          1,
          1
        );
      popover.permittedArrowDirections = UIPopoverArrowDirection.Any;
    }

    viewController.presentViewControllerAnimatedCompletion(alert, true, null);
  }
}
