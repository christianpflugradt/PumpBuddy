from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import Formatting, StrictModel


class Authority(StrictModel):
    applies_to: List[str]


class TestCategory(StrictModel):
    required: List[str]
    optional_future: List[str]


class PurposeRulesBoundaries(StrictModel):
    purpose: List[str]
    rules: List[str]
    boundaries: List[str]


class PurposeRules(StrictModel):
    purpose: List[str]
    rules: List[str]


class ExpectedTools(StrictModel):
    unit_and_integration: List[str]
    end_to_end: List[str]


class Infrastructure(StrictModel):
    expected_tools: ExpectedTools
    rules: List[str]


class TestStrategyDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["test_strategy"]
    formatting: Formatting
    authority: Authority
    test_categories: TestCategory
    unit_testing: PurposeRulesBoundaries
    integration_testing: PurposeRulesBoundaries
    end_to_end_testing: PurposeRules
    infrastructure: Infrastructure
    when_tests_required: List[str]
    when_tests_may_be_omitted: List[str]
    review_expectations: List[str]
