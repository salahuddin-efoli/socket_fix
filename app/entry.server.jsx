import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";
import { createInstance } from "i18next";
import i18next from "./i18next.server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-fs-backend";
import i18n from "./i18n"; // your i18n configuration file
import { resolve } from "path";
import { existsSync } from "fs";

const ABORT_DELAY = 5000;

export default async function handleRequest(
	request,
	responseStatusCode,
	responseHeaders,
	remixContext,
) {
	addDocumentResponseHeaders(request, responseHeaders);
	const userAgent = request.headers.get("user-agent");
	const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

	let instance = createInstance();
	let lng = await i18next.getLocale(request);
	let ns = i18next.getRouteNamespaces(remixContext);

    // Parse the URL to get the search parameters
	let { searchParams } = new URL(request.url);
    // Check if the 'locale' parameter is present in the URL
	if (searchParams.get("locale")) {
        // Split the 'locale' parameter to get locale and namespace
		var locale_with_ns = searchParams.get("locale")?.split("-");

        // Check if this language has namespace, like Chinese and Portuguese
        // If yes, set the language-namespace combination as the language
        if(locale_with_ns[0] == "zh" || locale_with_ns[0] == "pt") {
            lng = searchParams.get("locale");
            ns = "common";
        }
        else {
            // First part is the locale
            lng = locale_with_ns[0];

            // Second part is the namespace, default to 'common' if not provided
            let ns_string = (locale_with_ns[1] ? locale_with_ns[1] : "common").toLowerCase();

            // Check if the namespace file exists, default to 'common' if it doesn't
            ns = [existsSync("public/locales/" + lng + "/" + ns_string + ".json") ? ns_string : "common"];
        }
	}

	await instance
		.use(initReactI18next) // Tell our instance to use react-i18next
		.use(Backend) // Setup our backend
		.init({
			...i18n, // spread the configuration
			lng, // The locale we detected above
			ns, // The namespaces the routes about to render wants to use
			backend: { loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json") },
		});

	return new Promise((resolve, reject) => {
		const { pipe, abort } = renderToPipeableStream(
			<I18nextProvider i18n={instance}>
				<RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />
			</I18nextProvider>,
			{
				[callbackName]: () => {
					const body = new PassThrough();
					const stream = createReadableStreamFromReadable(body);

					responseHeaders.set("Content-Type", "text/html");
					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);
					pipe(body);
				},
				onShellError(error) {
					reject(error);
				},
				onError(error) {
					responseStatusCode = 500;
					reject(error);
				},
			},
		);

		setTimeout(abort, ABORT_DELAY);
	});
}
