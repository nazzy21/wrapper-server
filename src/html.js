export default function html(config, serverObject) {
	const {lang = "en", name, tagline, client} = config,
		serverName = serverObject.name,
		preload = serverObject.getPreload(client),
		css = serverObject.getCSS(client),
		scripts = serverObject.getScripts(client);

	const configData = JSON.stringify(config),
		time = Date.now();
		
		return `<!DOCTYPE html>
<html lang="${lang}">
<head>
	<title>${name} - ${tagline}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="description" content="${tagline}"/>
    ${iterateCSS(css, serverObject)}
</head>
<body class="${client}">
	<div id="doc-root">${preload}</div>
	${iterateScripts(scripts, serverObject)}
	<script type="text/javascript">
	${serverName}(${configData})
	</script>
</body>
</html>`;
}

function iterateCSS(css, server) {
	const list = [],
		isProduction = server.isProduction(),
		time = (new Date()).getTime();

	for(const {src, devSrc, version} of css) {
		let _src = isProduction ? src : (devSrc||src),
			ver = !isProduction? time : (version||server.version);

		list.push(`<link rel="stylesheet" type="text/css" media="all" href="${_src}?v=${ver}"/>`)
	}

	return list.join("\r\n");
}

function iterateScripts(scripts, server) {
	const list = [],
		isProduction = server.isProduction(),
		time = (new Date()).getTime();

	for(const {src, devSrc, version} of scripts) {
		let _src = isProduction ? src : (devSrc||src),
			ver = !isProduction? time : (version||server.version);

		_src += `?v=${ver}`;

		list.push(`<script type="text/javascript" src="${_src}"></script>`);
	}

	return list.join("\r\n");
}