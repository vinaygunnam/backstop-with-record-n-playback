const atob = require("atob");
const btoa = require("btoa");
const statusLookup = require("./status-lookup.json");

const requestCache = new Map();

function generateRawResponse(body, headers, status) {
  const newHeaders = {
    ...headers,
    Date: new Date().toUTCString(),
    Connection: "closed",
    "Content-Length": body.length
  };

  const headersAsText = Object.keys(newHeaders)
    .map(key => `${key}: ${headers[key]}`)
    .join("\r\n");

  const statusAsText = `${status} ${statusLookup[status]}`;

  return btoa(`HTTP/1.1 ${statusAsText}\r\n${headersAsText}\r\n\r\n${body}`);
}

async function cacheForReferenceGeneration(page, resourceTypes, contentTypes) {
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.setRequestInterception", {
    patterns: resourceTypes.map(resourceType => ({
      urlPattern: "*",
      resourceType,
      interceptionStage: "HeadersReceived"
    }))
  });

  client.on(
    "Network.requestIntercepted",
    async ({
      interceptionId,
      request,
      responseHeaders,
      responseStatusCode
    }) => {
      const response = await client.send(
        "Network.getResponseBodyForInterception",
        { interceptionId }
      );
      const contentTypeHeader = Object.keys(responseHeaders).find(
        k => k.toLowerCase() === "content-type"
      );
      const contentType = responseHeaders[contentTypeHeader];

      const matchingContentType = contentTypes.find(
        type => contentType.indexOf(type) > -1
      );

      let finalResponse;
      let originalBody = response.base64Encoded
        ? atob(response.body)
        : response.body;
      if (matchingContentType) {
        const lookupKey = `${request.method}:${request.url}`;
        const isCached = requestCache.has(lookupKey);

        if (!isCached) {
          requestCache.set(
            lookupKey,
            generateRawResponse(
              originalBody,
              responseHeaders,
              responseStatusCode
            )
          );
        }

        finalResponse = requestCache.get(lookupKey);
      } else {
        finalResponse = generateRawResponse(
          originalBody,
          responseHeaders,
          responseStatusCode
        );
      }

      client.send("Network.continueInterceptedRequest", {
        interceptionId,
        rawResponse: finalResponse
      });
    }
  );
}

module.exports = cacheForReferenceGeneration;
