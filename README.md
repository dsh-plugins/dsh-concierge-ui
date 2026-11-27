<div align="center">

<img src="icon.svg" width="256" height="256" alt="dsh-concierge-ui icon">

# dsh-concierge-ui

**Use Prism in a browser to send messages and follow delegated work.**

English | [简体中文](README.zh_CN.md)

</div>

## Install in the DSH web app

Open **Plugins → Add plugin** and enable the required `@dsh-prism` packages in the order shown in the guide. To install this package, enter `@dsh-prism/dsh-concierge-ui@0.2.1`. [Illustrated installation guide](https://prism.dsh-plug.in/guide/start)

Add a model provider in **Settings → Models** and open a workspace in DSH. Prism uses the workspaces registered in DSH as projects. In **Prism/Configuration**, select the allowed models for each layer or edit a model’s description and additional prompt. A layer with no selected models follows the DSH default. Click **Prism** in the DSH sidebar to send a request across projects. Expand a task card to follow progress. Manage messaging accounts under **Settings → Prism/IM**. [Two-project walkthrough](https://prism.dsh-plug.in/guide/start)

## Run the standalone host from source

Use Node.js 24.9 or later, npm, Git and credentials with read access to the five private plugin repositories. The checkout script places matching plugins and launcher files in a local `runtime/` directory. Run subsequent installation, configuration and launch commands there. The public guide is available without signing in. To use the example models, configure your DeepSeek credentials in DSH or set the `DEEPSEEK_API_KEY` environment variable. [Installation guide](https://prism.dsh-plug.in/)

```sh
git clone https://github.com/dsh-plugins/dsh-prism.git
cd dsh-prism
node scripts/checkout.mjs
cd runtime
npm ci
npm run build
npm start
```

## Start chatting

Open the login link printed by your Prism host. DSH authenticates the browser and opens `/prism`. Type your request and press Enter to send. Shift + Enter inserts a newline. For example, ask “Where does this project validate a model switch?”

## Choose a model and check progress

Open the model selector immediately to the left of Send. Read the capability descriptions and select the L1 model for subsequent messages. A delegated request creates a collapsed task card in the conversation. Expand the card to see its status and execution steps. When using Prism in the DSH web app, return to DSH to inspect detailed session history. Reloading the page restores the conversation. The interface follows your browser’s preferred supported language.

[Prism documentation](https://prism.dsh-plug.in/) · [Technical reference](docs/TECH.md)
