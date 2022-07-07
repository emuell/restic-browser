import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from '../states/app-state';

import '@vaadin/horizontal-layout';
import '@vaadin/button';

// -------------------------------------------------------------------------------------------------
 
// Allow opening new repositories and shows active repository in a header alike view

@customElement('restic-browser-app-header')
export class ResticBrowserAppHeader extends MobxLitElement {

  @property()
  openRepositoryClick?: () => void = undefined;

  static styles = css`
    #header {
      align-items: center;
    }
    #header h3 {
      font-size: var(--lumo-font-size-l);
      margin-left: 12px;
      margin-right: 12px;
    }
    #header #repoPath {
      margin-left: 12px;
      color: var(--lumo-tint-50pct);
      margin-top: 4px;
      margin-right: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #header #repoPath.disabled {
      color: var(--lumo-tint-10pct);
    } 
  `;

  render() {
    let repositoryName = appState.repoLocation.path;
    if (repositoryName && appState.repoLocation.prefix) {
      repositoryName = appState.repoLocation.prefix + ": " + repositoryName;
    }
    if (! repositoryName) {
      repositoryName = "No repository selected";
    }
    
    return html`
      <vaadin-horizontal-layout id="header">
        <h3>Restic-Browser</h3>
        <vaadin-button theme="primary" 
          @click=${() => {
            if (this.openRepositoryClick) { 
              this.openRepositoryClick(); 
             } 
            } 
          }>
          Open Repository
        </vaadin-button>
        <div id="repoPath" class="${!appState.repoLocation.path ? "disabled" : ""}">
          ${repositoryName}
        </div>
      </vaadin-horizontal-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-app-header': ResticBrowserAppHeader
  }
}


