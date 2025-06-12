import { JSX, useEffect } from "react";

export default function ThemeToggler(): JSX.Element {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	const applyTheme = (isDark: boolean): void => {
		document.documentElement.setAttribute("data-theme", isDark ? "customDark" : "customLight");
	};

	useEffect(() => {
		// Apply nitial theme
		applyTheme(mediaQuery.matches);

		// React to future changes
		const listener = (event: MediaQueryListEvent): void => applyTheme(event.matches);
		mediaQuery.addEventListener("change", listener);
	}, []);

	return <></>;
}
