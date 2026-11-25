import React from "react";
import avatar from "../../assets/bookworm.webp";
export function SpiritAvatar({ size = 32 }) {
  return (
    <img
      className="arr-spirit-avatar"
      src={avatar}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}
