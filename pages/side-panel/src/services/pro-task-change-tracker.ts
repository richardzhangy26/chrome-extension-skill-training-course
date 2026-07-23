const createProTaskChangeTracker = (initialTaskId: string | null) => {
  let currentTaskId = initialTaskId;

  const update = (nextTaskId: string | null) => {
    if (nextTaskId === currentTaskId) {
      return false;
    }
    currentTaskId = nextTaskId;
    return true;
  };

  return { update };
};

export { createProTaskChangeTracker };
