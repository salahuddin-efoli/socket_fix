import Backend from "i18next-fs-backend";
import { RemixI18Next } from "remix-i18next/server";
import i18n from "./i18n"; // your i18n configuration file
import { resolve } from "path";

let i18next = new RemixI18Next({
	detection: { supportedLanguages: i18n.supportedLngs, fallbackLanguage: i18n.fallbackLng },
	// The config here will be used for getFixedT
	i18next: {
		backend: { loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json") },
	},
	// This backend will be used by getFixedT
	backend: Backend,
});

export default i18next;