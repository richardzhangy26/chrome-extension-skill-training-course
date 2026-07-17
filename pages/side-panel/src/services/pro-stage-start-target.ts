interface ProStageStartSelection {
  stepId: string;
  overrodeServer: boolean;
}

interface ProStageStartTarget {
  request(stepId: string): void;
  consume(serverStepId: string): ProStageStartSelection;
  clear(): void;
  peek(): string | null;
}

const createProStageStartTarget = (): ProStageStartTarget => {
  let requestedStepId: string | null = null;
  return {
    request: stepId => {
      requestedStepId = stepId;
    },
    consume: serverStepId => {
      const target = requestedStepId;
      requestedStepId = null;
      return target
        ? { stepId: target, overrodeServer: target !== serverStepId }
        : { stepId: serverStepId, overrodeServer: false };
    },
    clear: () => {
      requestedStepId = null;
    },
    peek: () => requestedStepId,
  };
};

export { createProStageStartTarget };
export type { ProStageStartSelection, ProStageStartTarget };
