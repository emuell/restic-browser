/** biome-ignore-all lint/complexity/useLiteralKeys: clarity */
import * as mobx from "mobx";

import { restic } from "../backend/restic";
import { Location } from "./location";

// -------------------------------------------------------------------------------------------------

/*!
 * Represents an observable repository location preset item,
 * which basically is just a location with a display name.
 */

export class LocationPreset {
  @mobx.observable
  name: string = "New Location";

  @mobx.observable
  location: Location = new Location();

  constructor() {
    mobx.makeObservable(this);
  }

  // assign from JSON
  fromJSON(json: any) {
    const name = (json["name"] as string) || "Untitled Preset";
    const location = new restic.Location(json["location"]);
    this.name = name;
    this.location.setFromResticLocation(location);
  }

  // convert to JSON
  toJSON(): any {
    return {
      name: this.name,
      location: new restic.Location(this.location),
    };
  }

  // reset all location properties
  @mobx.action
  reset(): void {
    this.name = "Untitled";
    this.location.reset();
  }
}
