/**
 * 工作流状态机
 * 遵循开闭原则，通过配置扩展而非修改
 */

import type { WorkflowState } from './types.js';
import { WORKFLOW_TRANSITIONS } from './constants.js';

export interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  timestamp: number;
}

export class WorkflowStateMachine {
  private currentState: WorkflowState = 'IDLE';
  private history: StateTransition[] = [];

  constructor(initialState: WorkflowState = 'IDLE') {
    this.currentState = initialState;
  }

  getState(): WorkflowState {
    return this.currentState;
  }

  getHistory(): ReadonlyArray<StateTransition> {
    return [...this.history];
  }

  canTransitionTo(nextState: WorkflowState): boolean {
    const allowedTransitions = WORKFLOW_TRANSITIONS[this.currentState] as readonly string[];
    return allowedTransitions.includes(nextState);
  }

  transitionTo(nextState: WorkflowState): boolean {
    if (!this.canTransitionTo(nextState)) {
      console.warn(
        `Invalid state transition: ${this.currentState} -> ${nextState}. ` +
          `Allowed: ${WORKFLOW_TRANSITIONS[this.currentState].join(', ')}`,
      );
      return false;
    }

    this.history.push({
      from: this.currentState,
      to: nextState,
      timestamp: Date.now(),
    });

    this.currentState = nextState;
    return true;
  }

  reset(): void {
    this.currentState = 'IDLE';
    this.history = [];
  }

  isIdle(): boolean {
    return this.currentState === 'IDLE';
  }

  isInProgress(): boolean {
    return ['FETCHING_STEPS', 'FETCHING_FIRST_STEP', 'RUNNING_CARD', 'CHATTING'].includes(this.currentState);
  }

  isCompleted(): boolean {
    return this.currentState === 'COMPLETED';
  }

  isError(): boolean {
    return this.currentState === 'ERROR';
  }
}

// 创建状态机实例的工厂函数
export function createWorkflowStateMachine(initialState?: WorkflowState): WorkflowStateMachine {
  return new WorkflowStateMachine(initialState);
}
