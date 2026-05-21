import pytest
from strataforge.core.status import (
    DesignStatus,
    ProposalState,
    ReviewState,
    assert_status_promotion_allowed,
)


def test_promotion_scaffolded_to_expanded_allowed():
    assert_status_promotion_allowed(DesignStatus.scaffolded, DesignStatus.expanded)


def test_promotion_scaffolded_to_implemented_rejected():
    with pytest.raises(ValueError, match="not allowed"):
        assert_status_promotion_allowed(DesignStatus.scaffolded, DesignStatus.implemented)
