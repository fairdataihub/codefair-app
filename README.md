<div align="center">

<img src="https://raw.githubusercontent.com/fairdataihub/codefair-app/main/ui/public/assets/images/codefair_logo.png" alt="logo" width="200" height="auto" />

<br />

<h1>codefair</h1>

<p>
Your coding assistant to make research software reusable without breaking a sweat!
</p>

<br />
    <a href="https://github.com/marketplace/codefair-app"><strong> Get the app »</strong></a>
    <br />
<br />
    <a href="https://codefair.io/"><strong>Learn more »</strong></a>

<br />    
<br />

<p>
  <a href="https://github.com/fairdataihub/codefair-app/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/fairdataihub/codefair-app.svg?style=flat-square" alt="contributors" />
  </a>
  <a href="https://github.com/fairdataihub/codefair-app/stargazers">
    <img src="https://img.shields.io/github/stars/fairdataihub/codefair-app.svg?style=flat-square" alt="stars" />
  </a>
  <a href="https://github.com/fairdataihub/codefair-app/issues/">
    <img src="https://img.shields.io/github/issues/fairdataihub/codefair-app.svg?style=flat-square" alt="open issues" />
  </a>
  <a href="https://github.com/fairdataihub/codefair-app/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/fairdataihub/codefair-app.svg?style=flat-square" alt="license" />
  </a>
  <a href="https://fairdataihub.org/fairshare">
    <img src="https://raw.githubusercontent.com/fairdataihub/FAIRshare/main/badge.svg" alt="Curated with FAIRshare" />
  </a>
</p>

</div>

<br />

---

## Description

codefair is your personal assistant when it comes to making your research software reusable and especially complying with the [Findable, Accessible, Interoperable, Reusable (FAIR) Principles for Research Software](https://doi.org/10.1038/s41597-022-01710-x). Whether you are developing artificial intelligence (AI)/machine learning (ML) models with Python, data visualization tools with Jupyter notebook, or data analysis code with R, codefair is here to assist you. By communicating with you through GitHub issues and submitting pull requests, codefair will make sure that your software follows best coding practices, provides metadata in standard format, includes a license file, is archived on Zenodo, and much more. With codefair by your side, you're not just developing software but you're advocating for better software practices. Learn more on the app's website [codefair.io](https://codefair.io/).

![screenshot of the License issue up to where is it closed with the PR](https://i.imgur.com/JamRWHF.png)

## Getting started

### Installing

1. Install codefair-app on the GitHub organizations or repositories of your choice
2. Code and develop your software as usual
3. Follow codefair-app's instructions when it opens an issue or submit a pull request

### Permissions Required

codefair requires a few repository permissions to be able to listen to events happening on a repository and act accordingly to make software FAIR.
The permissions required include:

- Read access to:
  - Repository contents
  - Repository metadata
  - Repository pull requests
  - Repository issues
- Write access to:
  - Repository pull requests
  - Repository issues
  - Repository contents

### Features

List of features:

- License checker (released): This feature checks for a LICENSE file in repositories that have at lease one commit and opens a GitHub issue if no LICENSE file is found. Users can find helpful ressources for selecting a license in the issue message. Users can also reply with the name of the desired license and the app automatically submits a pull request with a LICENSE file that contains license terms associated with the desired license.
- CITATION.cff generator (released): This features checks for a CITATION.cff file in repositories that have a LICENSE file and opens a GitHub issue if no CITATION.cff file is found. Users can find helpful resources for preparing a CITATION.cff file. Users can also request the app to create one and submit a pull request while also being provided a link to edit within the GitHub UI if needed.
- Zenodo archival (upcoming): This feature checks if a GitHub repository is already archived on Zenodo. If not, the app open a Github issue that guides users into linking their GitHub repository with their Zenodo account so every GitHub release of the software is automatically archived on Zenodo by the app with CITATION.cff file updated before the release.

More features are in the work!

## Testing

You can follow these steps for testing the app:

- Create a GitHub repository with e.g., a README file or some other code files included but no LICENSE specified
- Install codefair on that repository from the GitHub markplace: https://github.com/marketplace/codefair-app
- Check the GitHub issue opened by the app about missing license file.
- Interact with the app by replying to the issue. E.g., reply with a non existing license name first like "@codefair-app random license" and then with an existing one like "@codefair-app MIT".
- Check out and merge the pull request opened by the app to see the issue being closed automatically.

A demo video is available [here](https://youtu.be/_fjUz52mKwM).

## Run Locally

### Setup

To run locally you will need to create a GitHub app from an account.

```sh
# Install dependencies
npm install
```

```sh
# Run the bot and visit localhost:3000 to connect Probot to your GitHub app
npm start
```

### Docker

```sh
# 1. Build container
docker build -t codefair .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> codeFAIR
```

## How codefair is developed

codefair is developed using Probot and is deployed on Vercel as a serverless function. The GitHub app is configured to receive webhooks for imoprtants actions such as pushing code, opening or closing issues, opening or merging pull requests and commenting on discussions.
By leveraging a serverless environment on Vercel, codefair can automatically scale to handle the workload of the GitHub app. The app is written in Node.js and utilizes the Octokit library to interact with the GitHub APIenabling seamless integration with GitHub's features and functionality.

## Contributing

<a href="https://github.com/fairdataihub/codefair-app/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=fairdataihub/codefair-app" />
</a>

Contributions are always welcome!

If you are interested in reporting/fixing issues and contributing directly to the code base, please see [CONTRIBUTING.md](CONTRIBUTING.md) for more information on what we're looking for and how to get started.

## Issues and Feedback

To report any issues with the software, suggest improvements, or request a new feature, please open a new issue via the [Issues](https://github.com/fairdataihub/codefair-app/issues) tab. Provide adequate information (operating system, steps leading to error, screenshots) so we can help you efficiently.

## License

This work is licensed under
[MIT](https://opensource.org/licenses/mit). See [LICENSE](https://github.com/AI-READI/pyfairdatatools/blob/main/LICENSE) for more information.

## How to cite

If you are using this package or reusing the source code from this repository for any purpose, please cite:

```text
    Coming soon...
```

## Acknowledgements

```text
    Coming soon...
```

<br />

---

<br />

<div align="center">

<a href="https://codefair.io">
  <img src="https://raw.githubusercontent.com/fairdataihub/codefair-app/main/public/assets/images/codefair_logo_name.png" alt="logo" width="200" height="auto" />
</a>

</div>
