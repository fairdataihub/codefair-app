<div align="center">

<img src="https://raw.githubusercontent.com/fairdataihub/codefair-app/main/ui/public/assets/images/codefair_logo.png" alt="logo" width="200" height="auto" />

<br />

<h1>Codefair</h1>

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

Codefair is your personal assistant when it comes to making your research software reusable and especially complying with the [Findable, Accessible, Interoperable, Reusable (FAIR) Principles for Research Software](https://doi.org/10.1038/s41597-022-01710-x). Whether you are developing artificial intelligence (AI)/machine learning (ML) models with Python, data visualization tools with Jupyter notebook, or data analysis code with R, Codefair is here to assist you. By communicating with you through GitHub issues and submitting pull requests, Codefair will make sure that your software follows best coding practices, provides metadata in standard format, includes a license file, is archived on Zenodo, and much more. With Codefair by your side, you're not just developing software but you're advocating for better software practices. Learn more on the app's website [codefair.io](https://codefair.io/).

![screenshot of the License issue up to where is it closed with the PR](https://imgur.com/fcOuzTC.png)

## Getting started

### Installing

1. Install Codefair from the [GitHub market place](https://github.com/marketplace/codefair-app) on the GitHub organizations or repositories of your choice
2. Code as usual
3. Track FAIR compliance issues through the Codefair issue dashboard and address them through the Codefair website.

> [!NOTE]
> While Codefair is free, installing it via the GitHub Marketplace may still require a credit card to be associated with your (or your organization’s) GitHub account. To circumvent this requirement, you can alternatively install Codefair directly from the [app page](https://github.com/apps/codefair-app).

### Documentation
See the our [dedicated webpage](https://docs.codefair.io) for the full documentation, including details about each features and how to use them.

## Run the GitHub app locally

### Setup

This repository uses a pnpm workspace to handle both the bot and the frontend UI. You will need to install pnpm globally to run the app locally. You will also need to be on Node.js version 20 or higher.

```bash
npm install -g pnpm
```

To start both the bot and the frontend UI, run the following command at the root of the repository:

```bash
pnpm dev
```

This will start the bot and the frontend UI in development mode. The bot will be available at `http://localhost:3001` and the frontend UI will be available at `http://localhost:3000`.

The .env files for each package are located in the respective package directories. You will need to create a `.env` file in the `bot` and `ui` directories. Use the .env.example files in each directory as a template.

To run the bot only, run the following command at the root of the repository:

```bash
cd bot
pnpm dev
```

To run the frontend UI only, run the following command at the root of the repository:

```bash
cd ui
pnpm dev
```

## How Codefair is developed

Codefair is developed using Probot and is deployed on a server as a serverless function. The GitHub app is configured to receive webhooks for important actions such as pushing code, opening or closing issues, opening or merging pull requests and commenting on discussions.
By leveraging a serverless environment on a server, Codefair can automatically scale to handle the workload of the GitHub app. The app is written in Node.js and utilizes the Octokit library to interact with the GitHub APIenabling seamless integration with GitHub's features and functionality.

## Contributing

<a href="https://github.com/fairdataihub/codefair-app/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=fairdataihub/codefair-app" />
</a>

Contributions are always welcome!

If you are interested in reporting/fixing issues and contributing directly to the code base, please see [CONTRIBUTING.md](CONTRIBUTING.md) for more information on what we're looking for and how to get started.

## Issues and Feedback

To report any issues with the software, suggest improvements, or request a new feature, please open a new issue via the [Issues](https://github.com/fairdataihub/codefair-app/issues) tab. Alternatively, you can also use our [contact form](https://tally.so/r/3E0dao). Provide adequate information (operating system, steps leading to error, etc.) so we can help you efficiently.

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
  <img src="https://raw.githubusercontent.com/fairdataihub/codefair-app/main/ui/public/assets/images/codefair_logo_name.png" alt="logo" width="200" height="auto" />
</a>

</div>
