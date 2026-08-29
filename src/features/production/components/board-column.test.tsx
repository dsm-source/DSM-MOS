import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { BoardColumn } from "./board-column";

describe("BoardColumn", () => {
  it("collapsed 'Selesai' column still mounts a droppable node and shows header + count", () => {
    render(
      <DndContext>
        <BoardColumn id="selesai" label="Selesai" count={4} collapsible>
          <div>card</div>
        </BoardColumn>
      </DndContext>,
    );
    // droppable ref element is present even while collapsed
    expect(screen.getByTestId("board-column-selesai")).toBeInTheDocument();
    expect(screen.getByText("Selesai")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
