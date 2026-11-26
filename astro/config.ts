// The integration's options, as the component reads them (see index.ts). Without the integration in
// astro.config, this import fails: add `focusReader()` to `integrations`.
/// <reference path="./virtual.d.ts" />
import config from 'virtual:focus-reader/config';

export default config;
