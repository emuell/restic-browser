import { MobxLitElement } from "@adobe/lit-mobx";
import { css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import * as mobx from "mobx";

import { appState } from "../states/app-state";

import "@vaadin/horizontal-layout";

// -------------------------------------------------------------------------------------------------

// Status bar alike footer in the restic browser app

@customElement("restic-browser-app-footer")
export class ResticBrowserAppFooter extends MobxLitElement {
  @state()
  private _statusMessage: string = "";

  constructor() {
    super();

    let messageTimeoutId: NodeJS.Timeout | undefined = undefined;
    mobx.autorun(() => {
      let newMessage = "";
      if (appState.pendingFileDumps.length) {
        const last = appState.pendingFileDumps[appState.pendingFileDumps.length - 1];
        newMessage = `Restoring '${last.file.name}'`;
        if (appState.pendingFileDumps.length > 2) {
          newMessage += ` and ${appState.pendingFileDumps.length - 1} other entries`;
        } else if (appState.pendingFileDumps.length > 1) {
          newMessage += ` and one other entry`;
        }
        newMessage += ". Please wait...";
      } else if (appState.isLoadingSnapshots > 0) {
        newMessage = "Fetching snapshots...";
      } else if (appState.isLoadingFiles > 0) {
        newMessage = "Fetching files...";
      }
      if (newMessage !== "") {
        if (messageTimeoutId !== undefined) {
          clearTimeout(messageTimeoutId);
          messageTimeoutId = undefined;
        }
        this._statusMessage = newMessage;
      } else {
        messageTimeoutId = setTimeout(() => {
          this._statusMessage = "";
          messageTimeoutId = undefined;
        }, 1000);
      }
    });
  }

  static styles = css`
    #footer {
      background: var(--lumo-shade-10pct);
      height: 100%;
      padding: 0 4px;
      align-items: center;
      font-size: smaller;
    }
  `;

  render() {
    return html`
      <vaadin-horizontal-layout id="footer">
        ${this._statusMessage}
      </vaadin-horizontal-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    "restic-browser-app-footer": ResticBrowserAppFooter;
  }
}
