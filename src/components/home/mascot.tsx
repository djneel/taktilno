"use client";

import { Mascot } from "page-mascot";

export function HomeMascot() {
  return (
    <Mascot
      directions="/mascots/cat-directions.png"
      reactions="/mascots/cat-reactions.png"
      size={140}
      label="Котик-маскота ТАКТИЛЬНО"
    />
  );
}
