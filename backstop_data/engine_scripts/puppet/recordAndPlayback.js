const cacheForReferenceGeneration = require("../../../lib/reference-cache");
const { record, playback } = require("../../../lib/network-logger");

function isDataResource(request) {
  if (!request) return false;
  const resourceType = request.resourceType();
  return resourceType === "xhr" || resourceType === "fetch";
}

/**
 *
 * @param {import('puppeteer').Page} page
 * @param {*} scenario
 * @param {*} isReference
 */
async function recordAndPlayback(page, scenario, isReference) {
  const resourceTypes = ["XHR", "Fetch"];
  const contentTypes = ["application/xml", "application/json"];

  if (isReference) {
    cacheForReferenceGeneration(page, resourceTypes, contentTypes);
  }

  await page.setRequestInterception(true);
  page.on("request", req => {
    const shouldUseStub = isDataResource(req);

    if (shouldUseStub) {
      const stubResponse = playback(scenario.label, req.url(), req.method());

      if (stubResponse) {
        req.respond(stubResponse);
      } else {
        console.info(`MOCK_MISS for ${req.url()}`);
        if (isReference) {
          req.continue();
        } else {
          req.abort();
        }
      }
    } else {
      req.continue();
    }
  });

  page.on("response", async res => {
    const req = res.request();
    const shouldRecord = isReference && isDataResource(req);

    if (shouldRecord) {
      if (isReference) {
        const status = res.status();
        const headers = res.headers();

        if (status > 299 && status < 400) {
          // this is a redirect response (i.e. has no body)
          // nothing to record
        } else {
          const body = await res.text();
          record(scenario.label, req.url(), req.method(), {
            body,
            headers,
            status
          });
        }
      }
    }
  });
}

module.exports = recordAndPlayback;
