from enum import Enum


class DesignStatus(str, Enum):
    scaffolded = "scaffolded"
    expanded = "expanded"
    reconciled = "reconciled"
    execution_ready = "execution_ready"
    implemented = "implemented"
    verified = "verified"
    stale = "stale"


class ProposalState(str, Enum):
    proposed = "proposed"
    accepted = "accepted"
    revised = "revised"
    rejected = "rejected"
    out_of_scope = "out_of_scope"
    deferred = "deferred"
    promoted_to_scaffold = "promoted_to_scaffold"


class ReviewState(str, Enum):
    unreviewed = "unreviewed"
    accepted = "accepted"
    needs_revision = "needs_revision"
    rejected = "rejected"
    out_of_scope = "out_of_scope"
    duplicate = "duplicate"
    split_needed = "split_needed"


_ALLOWED_PROMOTIONS = {
    (DesignStatus.scaffolded, DesignStatus.expanded),
    (DesignStatus.expanded, DesignStatus.reconciled),
    (DesignStatus.reconciled, DesignStatus.execution_ready),
    (DesignStatus.execution_ready, DesignStatus.implemented),
    (DesignStatus.implemented, DesignStatus.verified),
    (DesignStatus.expanded, DesignStatus.stale),
    (DesignStatus.reconciled, DesignStatus.stale),
    (DesignStatus.execution_ready, DesignStatus.stale),
}


def assert_status_promotion_allowed(current: DesignStatus, target: DesignStatus) -> None:
    if (current, target) not in _ALLOWED_PROMOTIONS:
        raise ValueError(f"Promotion {current.value} -> {target.value} not allowed")
