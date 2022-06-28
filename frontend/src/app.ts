import { css, html, TemplateResult } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import './components/file-list';
import './components/snapshot-list';
import './components/password-dialog';

import { OpenRepo, SelectRepo } from '../wailsjs/go/lib/Restoric'

import { appState } from './states/app-state';

import '@vaadin/button';
import '@vaadin/vertical-layout';
import '@vaadin/horizontal-layout';
import '@vaadin/icons';
import '@vaadin/icon';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('restoric-app')
export class RestoricApp extends MobxLitElement {
  
  static styles = css`
    h3 {
      font-size: var(--lumo-font-size-l);
      margin-left: 20px;
      margin-right: 20px;
    }
  `;
  
  @state()
  private _showPasswordDialog: boolean = false;

  private _selectRepository() {
    SelectRepo()
      .then((directory) => {
        if (directory instanceof Error) {
          appState.repoError = directory.message || String(directory);
        } else {
          appState.repoPath = directory;
          appState.repoError = "";
          this._showPasswordDialog = true;
        }
      })
      .catch((err) => {
        appState.repoError = err.message || String(err);
      });
  }

  private _openRepository() {
    OpenRepo(appState.repoPath, appState.repoPass)
      .then((result) => {
        if (result instanceof Error) {
          appState.repoError = result.message || String(result);
        } 
        else {
          appState.repoError = "";
        } 
      })
      .catch((err) => {
        appState.repoError = err.message || String(err);
      });
  }
  
  render() {
    // password dialog
    if (this._showPasswordDialog) {
      return html`
        <restoric-password-dialog 
          .onClose=${() => {
            this._showPasswordDialog = false;
            this._openRepository();
          }}
          .onCancel=${() => {
            this._showPasswordDialog = false; 
            appState.repoPath = ""; 
          }}></restoric-password-dialog>
      `;
    }
    // app content
    else {
      let content: TemplateResult;

      if (appState.repoError) {
        content = html`<div>Failed to open repository: ${appState.repoError}</div>`
      }
      else if (! appState.repoPath) {
        content = html`<div style="heigth=100%; text-align: center;">No repository selected</div>`
      }
      else {
        content = html`
          <!-- Snapshots -->
          <restoric-snapshot-list style="height: 200px;">Snapshots</restoric-snapshot-list>
          <!-- Contents -->
          <restoric-file-list style="height: 100%;">Contents</restoric-file-list>
        `;
      }
        
      return html`
        <vaadin-vertical-layout style="align-items: stretch; width: 100vw;">
          <!-- Header -->
          <vaadin-horizontal-layout style="align-items: center;">
            <h3>Restoric</h3>
            <vaadin-button theme="primary" @click=${this._selectRepository}>Select Repository</vaadin-button>
          </vaadin-horizontal-layout>
          <!-- Cntent -->
          ${content}
        </vaadin-vertical-layout>
      `
    }
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restoric-app': RestoricApp
  }
}
