import { OG_SIZE, ogImage } from "./og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "HandsUp: know the moment your class gets lost";

export default function Image() {
  return ogImage({ eyebrow: "Free for classrooms", title: "Know the moment your class gets lost.", sub: "Anonymous, live feedback from every student." });
}
