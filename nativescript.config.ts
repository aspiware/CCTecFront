import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'com.aspiware.cctec',
  name: 'CCTec',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  ios: {
    deploymentTarget: '13.0'
  },
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none'
  }
} as NativeScriptConfig;
