window.addEventListener('message', event => {
	const message = event.data;

	if (message.command === 'update') {
		const summary = message.data;

		if (summary.error) {
			document.getElementById('summary').innerText = summary.error;
		} else {
			document.getElementById('summary').innerHTML = `
		  <p>Total Lines: ${summary.totalLines}</p>
		  <p>Total Files: ${summary.filesCount}</p>
		  <p>Largest File: ${summary.largestFile.name} (${
				summary.largestFile.lines
			} lines)</p>
		  <p>Configuration Files: ${summary.configFiles}</p>
		  <p>Readme Found: ${summary.readme ? 'Yes' : 'No'}</p>
		  <p>Gitignore Found: ${summary.gitignore ? 'Yes' : 'No'}</p>
		  <p>Images: ${summary.images}</p>
		  <p>Videos: ${summary.videos}</p>
		  <p>Audio Files: ${summary.audio}</p>
		  <p>Binaries: ${summary.binaries}</p>
		  <p>Documents: ${summary.documents}</p>
		  <p>Scripts: ${summary.scripts}</p>
		  <p>Stylesheets: ${summary.stylesheets}</p>
		  <p>Templates: ${summary.templates}</p>
		`;
		}
	}
});
