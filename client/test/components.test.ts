import { describe, expect, it } from "vitest";
import { actionButton, box, button, chip, costLine, costText, esc, keyValues, kv, listRow, progressBar, verdict, why } from "../src/ui/components.js";
import { resourceIcon } from "../src/ui/icons.js";

describe("the interface's shared pieces", () => {
  it("a button the rules refuse stays tappable: aria-disabled, never disabled, and its reason under it", () => {
    const refused = actionButton("Upgrade", { ok: false, reason: "Your 2 builders are busy" }, "gold xl", "upgrade");
    expect(refused).toBe('<button class="b gold xl" data-act="upgrade" aria-disabled="true">Upgrade</button><p class="why">Your 2 builders are busy</p>');
    expect(refused).not.toMatch(/ disabled/);
    expect(actionButton("Upgrade", { ok: true }, "gold xl", "upgrade")).toBe('<button class="b gold xl" data-act="upgrade" aria-disabled="false">Upgrade</button>');
  });

  it("a button writes its classes, its act, its data and what follows as the sheets wrote them", () => {
    expect(button("+60", "sm", "train", ' data-troop="boarders"', true)).toBe('<button class="b sm" data-act="train" data-troop="boarders" aria-disabled="true">+60</button>');
    // A button the rules never refuse (Lead) has no aria-disabled at all.
    expect(button("Lead", "sm", "lead", ' data-captain="tom"')).toBe('<button class="b sm" data-act="lead" data-captain="tom">Lead</button>');
    expect(button("★", "sm gold", "star", "", false, ' aria-label="Add a star"')).toBe('<button class="b sm gold" data-act="star" aria-disabled="false" aria-label="Add a star">★</button>');
    expect(button("Sign out", "", "sign-out")).toBe('<button class="b" data-act="sign-out">Sign out</button>');
  });

  it("text from outside the game is escaped", () => {
    expect(esc(`<img src=x onerror="alert('1')">&`)).toBe("&#60;img src=x onerror=&#34;alert(&#39;1&#39;)&#34;&#62;&#38;");
  });

  it("the other pieces", () => {
    expect(why("Not enough oil")).toBe('<p class="why">Not enough oil</p>');
    expect(progressBar(0.5)).toBe('<div class="pb"><i style="width:50.0%"></i></div>');
    expect(progressBar(0.333, 0)).toBe('<div class="pb"><i style="width:33%"></i></div>');
    expect(chip("Max", "ok") + chip("In progress")).toBe('<span class="chip ok">Max</span><span class="chip">In progress</span>');
    expect(box("Train", "<p>x</p>")).toBe('<div class="box"><h4>Train</h4><p>x</p></div>');
    expect(box("Veterans", "", "vets", "with-icon")).toBe('<div class="box vets"><h4 class="with-icon">Veterans</h4></div>');
    expect(keyValues(kv("Level", 3) + kv("Beds", "40", "with-icon", "ok"))).toBe(
      '<div class="kv"><span>Level</span><span>3</span><span class="with-icon">Beds</span><span class="ok">40</span></div>',
    );
    expect(listRow("Kelp Greenhouse", "<small>+4.5 fish/h</small>", chip("Max"), "tech", ' data-x="1"', "<i></i>")).toBe(
      '<div class="it tech" data-x="1"><i></i><div class="tt"><b>Kelp Greenhouse</b><small>+4.5 fish/h</small></div><span class="chip">Max</span></div>',
    );
    expect(verdict("close", "Close fight")).toBe('<div class="verd close">Close fight</div>');
  });

  it("a cost marks what you lack", () => {
    expect(costText({ wood: 200, oil: 80 })).toBe("200 wood · 80 oil");
    expect(costLine({ wood: 500, oil: 10, fish: 0, rope: 0 }, { wood: 200, oil: 80 })).toBe(
      `<div class="cost"><span class="" title="wood">${resourceIcon("wood")}200</span><span class="no" title="oil">${resourceIcon("oil")}80</span></div>`,
    );
    // The Lighthouse's last levels: the Pearls come last, marked when you lack them; none when the level asks none.
    const lighthouse = costLine({ wood: 500, oil: 100, fish: 0, rope: 0 }, { wood: 200 }, { need: 7000, have: 6999 });
    expect(lighthouse).toBe(`<div class="cost"><span class="" title="wood">${resourceIcon("wood")}200</span><span class="no" title="Pearls">${resourceIcon("pearl")}7,000</span></div>`);
    expect(costLine({ wood: 500, oil: 100, fish: 0, rope: 0 }, { wood: 200 }, { need: 0, have: 0 })).toBe(costLine({ wood: 500, oil: 100, fish: 0, rope: 0 }, { wood: 200 }));
  });
});
