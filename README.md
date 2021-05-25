# Lucid

Application for Fitbit smartwatches that aim at triggering lucid dream during REM sleep. Still an early stage project.

## Overview

The "Front" is in `resources/`.

The Logic that contains almost everything is in `app/index.js`.

## Build and Install

See `https://dev.fitbit.com/build/guides/command-line-interface/` on how to use Fitbit SDK. We are using Fitbit SDK 4.2.

To build the app and install it run :
```
npm install
npx fitbit
fitbit$ bi
```

## Data

You can find examples of the data we record in `data`. `hrs.json` contains a list of hear rate measures, `as.json` contains a list of accelerations. 