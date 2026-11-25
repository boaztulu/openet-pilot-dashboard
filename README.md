# OpenET baseline pilot, Florida: dashboard

This is the interactive dashboard of an OpenET baseline pilot. The pilot reproduces the original OpenET Collection 2.1 pipeline for two flux towers in Florida in April 2024: the six models, OpenET's temporal interpolation and its MAD ensemble. The towers are NEON DSNY and OSBS (AmeriFlux US-xDS and US-xSB). The dashboard shows every stage, from the Landsat scenes to validation against official OpenET and against the towers, with video tours of every page.

**Open it:** https://boaztulu.github.io/openet-pilot-dashboard/ (password from the project team).

## How access works

The dashboard's pages, data and videos are stored in this repository encrypted with AES-256-GCM, so the files cannot be read without the password.

At sign-in, the password unlocks the key in your browser. The key is derived with PBKDF2-SHA256 and 600,000 iterations, and your browser keeps it for 12 hours or until "Sign out". A service worker (`sw.js`) then decrypts each file inside the browser; nothing is sent anywhere.

The only readable files are:
- the sign-in page and its scripts (`index.html`, `signin.js`, `session.js`, `sw.js`, `signin.css`);
- `access.json`, the locked key.

## Browsers

Use a current Chrome, Edge, Firefox or Safari in a normal window. Some private windows block service workers.

## Data credits

- NEON (National Ecological Observatory Network) (2025), AmeriFlux FLUXNET-1F US-xDS NEON Disney Wilderness Preserve (DSNY), Ver. v1.3_r1 (2019-2024), AmeriFlux AMP, (Dataset). https://doi.org/10.17190/AMF/1985439
- NEON (National Ecological Observatory Network) (2025), AmeriFlux FLUXNET-1F US-xSB NEON Ordway-Swisher Biological Station (OSBS), Ver. v1.3_r1 (2019-2024), AmeriFlux AMP, (Dataset). https://doi.org/10.17190/AMF/1985451
- FLUXNET data products were produced and harmonized by eddy covariance regional networks and data processing centers, including AmeriFlux, ChinaFlux, European Fluxes Database, ICOS, JapanFlux, KoFlux, OzFlux, SAEON, and TERN. These products also include a modified version of ERA5 hourly data provided by the Copernicus Climate Change Service. Funding for the AmeriFlux data service was provided by the U.S. Department of Energy Office of Science. The National Ecological Observatory Network is a project solely funded by the National Science Foundation and managed under cooperative agreement by Battelle.
- OpenET Collection 2.1: Melton et al. (2022), doi:10.1111/1752-1688.12956; Volk et al. (2024), doi:10.1038/s44221-023-00181-7.
- Landsat Collection 2 data courtesy of the U.S. Geological Survey.

## Source

The source code and the unencrypted data are kept in a private repository. This site is built from it with `platform/tools/build_pages.js`.
