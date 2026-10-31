import { OG_SIZE, ogImage } from "../og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "HandsUp for students";

export default function Image() {
  return ogImage({ eyebrow: "For students", title: "Ask without the awkward.", sub: "Tell your teacher you're lost. Anonymously. No app, no account." });
}
