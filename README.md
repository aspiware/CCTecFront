# CCTecFront

## Run Modes (Subscription Guard)

The app supports runtime flags for subscription behavior through `webpack.config.js`.

### 1) Dev mode (free access)

```bash
ns run ios
```

- No subscription validation in guard.
- Useful for normal feature development.

### 2) Dev mode with subscription enforced

```bash
ns run ios --env.enforceSubscription
```

- Enables subscription guard flow while still running in dev mode.
- Use this to test subscription screens/redirects locally.

### 3) Production mode (normal behavior)

```bash
ns run ios --env.production
```

- Uses production API base URL.
- Subscription guard is enforced.

### 4) Production mode with manual bypass

```bash
ns run ios --env.production --env.subscriptionBypass
```

- Keeps production config/API.
- Forces guard bypass for internal testing.

## Flags

- `--env.production`: sets production mode.
- `--env.enforceSubscription`: forces subscription guard in dev mode.
- `--env.subscriptionBypass`: bypasses subscription guard in any mode.

## Notes

- Do not use `subscriptionBypass` for public release testing.
- Preferred for real flow testing: use `--env.enforceSubscription` in dev, or production without bypass.
