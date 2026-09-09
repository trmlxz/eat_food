import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Stomach from "./Stomach";
import { defaults, foods } from "./data";

it("leaves the original drawing unchanged when no craving is supplied", () => {
  render(<Stomach level={4} items={[]} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(
    "4级胃部示意图，没有选择食物",
  );
  expect(document.querySelector(".thought-bubble")).toBeNull();
});

it.each([1, 2, 3, 4, 5, 6])(
  "keeps the thought bubble at the stomach's scale but outside its food clip and motion at level %i",
  (level) => {
    render(
      <Stomach
        level={level}
        items={[foods[0]]}
        craving={foods[1]}
        motion={{ ...defaults, motion: true }}
      />,
    );
    const bubble = document.querySelector(".thought-bubble")!;
    const motion = document.querySelector(".stomach-motion")!;
    expect(bubble).toHaveTextContent("🍌");
    expect(bubble.parentElement).toBe(motion.parentElement);
    expect(bubble.closest("[clip-path], .stomach-motion")).toBeNull();
    expect(motion).not.toHaveTextContent("🍌");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      `${level}级胃部示意图，苹果，想吃香蕉`,
    );
  },
);

it("renders photo cravings without the stomach fade and uses unique clipping ids across previews", () => {
  const craving = {
    id: "photo",
    name: "晚饭",
    image: "data:image/jpeg;base64,ZGlubmVy",
  };
  render(
    <>
      <Stomach level={4} items={[]} craving={craving} />
      <Stomach level={4} items={[]} craving={craving} />
    </>,
  );
  const images = document.querySelectorAll(".thought-bubble image");
  expect(images).toHaveLength(2);
  for (const image of images) {
    expect(image).toHaveAttribute("href", craving.image);
    expect(image.closest("[mask]")).toBeNull();
    const clipId = image.getAttribute("clip-path")!.slice(5, -1);
    expect(document.getElementById(clipId)).toBeInTheDocument();
  }
  expect(images[0].getAttribute("clip-path")).not.toBe(
    images[1].getAttribute("clip-path"),
  );
});
