import { OG_SIZE, ogImage } from "../og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "HandsUp for teachers";

export default function Image() {
  return ogImage({ eyebrow: "For teachers", title: "See the room, not just the front row.", sub: "Live understanding, grouped questions, a report after every lecture." });
}
