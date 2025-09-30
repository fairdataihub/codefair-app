<template>
  <n-config-provider :theme-overrides="overrides">
    <Notivue v-slot="item">
      <Notification :item="item" :theme="pastelTheme" />
    </Notivue>

    <NuxtLoadingIndicator color="#be185d" :height="5" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, type GlobalThemeOverrides } from "naive-ui";
import { pastelTheme } from "notivue";

const overrides: GlobalThemeOverrides = {
  Alert: {
    border: "1px solid var(--cf-alert-neutral-border)",
    borderError: "1px solid var(--cf-alert-error-border)",
    borderInfo: "1px solid var(--cf-alert-info-border)",
    borderRadius: "10px",
    borderSuccess: "1px solid var(--cf-alert-success-border)",
    borderWarning: "1px solid var(--cf-alert-warning-border)",

    closeBorderRadius: "8px",
    closeColorHover:
      "color-mix(in oklch, var(--cf-alert-neutral-text) 10%, transparent)",
    closeColorHoverError:
      "color-mix(in oklch, var(--cf-alert-error-text) 15%, transparent)",
    closeColorHoverInfo:
      "color-mix(in oklch, var(--cf-alert-info-text) 15%, transparent)",
    closeColorHoverSuccess:
      "color-mix(in oklch, var(--cf-alert-success-text) 15%, transparent)",
    closeColorHoverWarning:
      "color-mix(in oklch, var(--cf-alert-warning-text) 15%, transparent)",
    closeColorPressed:
      "color-mix(in oklch, var(--cf-alert-neutral-text) 20%, transparent)",
    closeColorPressedError:
      "color-mix(in oklch, var(--cf-alert-error-text) 25%, transparent)",
    closeColorPressedInfo:
      "color-mix(in oklch, var(--cf-alert-info-text) 25%, transparent)",
    closeColorPressedSuccess:
      "color-mix(in oklch, var(--cf-alert-success-text) 25%, transparent)",
    closeColorPressedWarning:
      "color-mix(in oklch, var(--cf-alert-warning-text) 25%, transparent)",
    closeIconColor: "var(--cf-alert-neutral-icon)",
    closeIconColorError: "var(--cf-alert-error-icon)",
    closeIconColorHover: "var(--cf-alert-neutral-text)",
    closeIconColorHoverError: "var(--cf-alert-error-text)",
    closeIconColorHoverInfo: "var(--cf-alert-info-text)",
    closeIconColorHoverSuccess: "var(--cf-alert-success-text)",
    closeIconColorHoverWarning: "var(--cf-alert-warning-text)",
    closeIconColorInfo: "var(--cf-alert-info-icon)",
    closeIconColorPressed: "var(--cf-alert-neutral-text)",
    closeIconColorPressedError: "var(--cf-alert-error-text)",
    closeIconColorPressedInfo: "var(--cf-alert-info-text)",
    closeIconColorPressedSuccess: "var(--cf-alert-success-text)",
    closeIconColorPressedWarning: "var(--cf-alert-warning-text)",
    closeIconColorSuccess: "var(--cf-alert-success-icon)",
    closeIconColorWarning: "var(--cf-alert-warning-icon)",

    color: "var(--cf-alert-neutral-bg)",
    colorError: "var(--cf-alert-error-bg)",
    colorInfo: "var(--cf-alert-info-bg)",
    colorSuccess: "var(--cf-alert-success-bg)",
    colorWarning: "var(--cf-alert-warning-bg)",

    contentTextColor: "var(--cf-alert-neutral-text)",
    contentTextColorError: "var(--cf-alert-error-text)",
    contentTextColorInfo: "var(--cf-alert-info-text)",
    contentTextColorSuccess: "var(--cf-alert-success-text)",
    contentTextColorWarning: "var(--cf-alert-warning-text)",

    iconColor: "var(--cf-alert-neutral-icon)",
    iconColorError: "var(--cf-alert-error-icon)",
    iconColorInfo: "var(--cf-alert-info-icon)",
    iconColorSuccess: "var(--cf-alert-success-icon)",
    iconColorWarning: "var(--cf-alert-warning-icon)",

    titleTextColor: "var(--cf-alert-neutral-text)",
    titleTextColorError: "var(--cf-alert-error-text)",
    titleTextColorInfo: "var(--cf-alert-info-text)",
    titleTextColorSuccess: "var(--cf-alert-success-text)",
    titleTextColorWarning: "var(--cf-alert-warning-text)",
  },
  Breadcrumb: {
    itemTextColor: "var(--cf-breadcrumb-item-text)",
    itemTextColorActive: "var(--cf-breadcrumb-item-text-active)",
    itemTextColorHover: "var(--cf-breadcrumb-item-text-hover)",
    itemTextColorPressed: "var(--cf-breadcrumb-item-text-hover)",
    separatorColor: "var(--cf-breadcrumb-separator)",
  },
  Button: {
    border: "2px dashed var(--cf-button-border)",
    borderDisabled: "1px dashed var(--cf-field-border-disabled)",
    borderFocus: "1px dashed var(--cf-field-border-focus)",
    borderFocusPrimary: "1px dashed var(--cf-primary)",
    borderGhost: "1px solid var(--cf-field-border-hover)",
    borderHover: "1px dashed var(--cf-field-border-hover)",
    borderHoverPrimary: "1px dashed var(--cf-primary-hover)",
    borderPressed: "1px dashed var(--cf-field-border-hover)",
    borderPressedPrimary: "1px dashed var(--cf-primary-pressed)",
    borderPrimary: "1px solid transparent",

    color: "transparent",
    colorDisabled: "transparent",
    colorFocus: "transparent",
    colorHover: "transparent",
    colorHoverPrimary: "var(--cf-primary-hover)",
    colorPressed: "transparent",
    colorPressedPrimary: "var(--cf-primary-pressed)",
    colorPrimary: "var(--cf-primary)",

    textColor: "var(--cf-text-2)",
    textColorDisabled: "var(--cf-text-3)",
    textColorFocus: "var(--cf-text-1)",
    textColorGhost: "var(--cf-text-2)",
    textColorHover: "var(--cf-text-1)",
    textColorPressed: "var(--cf-text-1)",
    textColorPrimary: "#fff",
    textColorTextFocusPrimary: "var(--cf-primary)",
    textColorTextHoverPrimary: "var(--cf-primary-hover)",
    textColorTextPressedPrimary: "var(--cf-primary-pressed)",

    textColorTextPrimary: "var(--cf-primary)",
  },

  Card: {
    borderColor: "var(--cf-card-border)",
    color: "var(--cf-card-bg)",
    colorEmbedded: "var(--cf-card-bg)",
    textColor: "var(--cf-card-text)",
  },
  Collapse: {
    arrowColor: "var(--cf-collapse-arrow)",
    arrowColorDisabled: "var(--cf-collapse-arrow-disabled)",
    dividerColor: "var(--cf-collapse-divider)",
    itemHeaderTextColor: "var(--cf-collapse-header-text)",
    itemHeaderTextColorDisabled: "var(--cf-collapse-header-text-disabled)",
    titleTextColor: "var(--cf-collapse-content-text)",
  },
  common: {
    primaryColor: "#4f46e5",
    primaryColorHover: "#6366f1",
    primaryColorPressed: "#312e81",
    primaryColorSuppl: "#0ea5e9",

    textColor1: "oklch(96% 0.01 260)",
    textColor2: "oklch(90% 0.01 260)",
    textColor3: "oklch(78% 0.01 260)",
  },
  DatePicker: {
    calendarTitleColorHover: "var(--cf-datepicker-item-hover-bg)",
    calendarTitleTextColor: "var(--cf-calendar-title-text-color)",
    iconColor: "var(--cf-datepicker-icon)",
    itemColorActive: "var(--cf-date-text)",
    itemColorHover: "var(--cf-datepicker-item-hover-bg)",
    itemColorIncluded: "var(--cf-datepicker-item-included-bg)",

    itemTextColor: "var(--cf-datepicker-item-text)",
    itemTextColorActive: "var(--cf-datepicker-item-text-active)",
    itemTextColorCurrent: "var(--cf-datepicker-item-text-current)",
    itemTextColorHover: "var(--cf-datepicker-item-text-active)",
    panelActionDividerColor: "var(--cf-datepicker-panel-divider)",
    panelBoxShadow: "var(--cf-datepicker-panel-shadow)",
    panelColor: "var(--cf-datepicker-panel-bg)",
    panelTextColor: "var(--cf-datepicker-panel-text)",
    textColor: "var(--cf-datepicker-panel-text)",
  },
  Divider: {
    color: "var(--cf-divider)",
  },
  Dropdown: {
    color: "var(--cf-dropdown-bg)",
    dividerColor: "var(--cf-dropdown-divider)",
    optionColorActive: "var(--cf-dropdown-option-active-bg)",
    optionColorHover: "var(--cf-dropdown-option-hover-bg)",
    optionOpacityDisabled: "var(--cf-dropdown-option-disabled-opacity)",
    optionTextColor: "var(--cf-dropdown-option-text)",
    optionTextColorActive: "var(--cf-dropdown-option-text-active)",
    optionTextColorChildActive: "var(--cf-dropdown-option-text-child-active)",
    optionTextColorHover: "var(--cf-dropdown-option-text-hover)",
    prefixColor: "var(--cf-dropdown-prefix)",
    suffixColor: "var(--cf-dropdown-suffix)",
  },
  Form: {
    asteriskColor: "var(--cf-asterisk)",
    feedbackTextColor: "var(--cf-text-3)",
    feedbackTextColorError: "var(--cf-feedback-error)",
    feedbackTextColorWarning: "var(--cf-feedback-warning)",
    labelTextColor: "var(--cf-text-2)",
  },
  Input: {
    border: "1px solid var(--cf-field-border)",
    borderDisabled: "1px solid var(--cf-field-border-disabled)",
    borderFocus: "1px solid var(--cf-field-border-focus)",
    borderHover: "1px solid var(--cf-field-border-hover)",
    boxShadowFocus: "var(--cf-field-ring)",
    caretColor: "var(--cf-caret)",
    color: "var(--cf-field-bg)",
    colorDisabled: "var(--cf-field-bg-disabled)",
    colorFocus: "var(--cf-field-bg-focus)",
    iconColor: "var(--cf-icon)",
    placeholderColor: "var(--cf-field-placeholder)",
    suffixTextColor: "var(--cf-suffix)",
    textColor: "var(--cf-field-text)",
  },
  Menu: {
    color: "var(--cf-menu-bg)",
    dividerColor: "var(--cf-menu-divider)",
    itemColorActive: "var(--cf-menu-item-active-bg)",
    itemColorHover: "var(--cf-menu-item-hover-bg)",
    itemTextColor: "var(--cf-menu-item-text)",
    itemTextColorActive: "var(--cf-menu-item-text-active)",
    itemTextColorHover: "var(--cf-menu-item-text-hover)",
  },
  Popover: {
    borderRadius: "10px",
    boxShadow: "var(--cf-popover-shadow)",
    color: "var(--cf-popover-bg)",
    dividerColor: "var(--cf-popover-divider)",
    textColor: "var(--cf-popover-text)",
  },
  Radio: {
    buttonBorderColor: "var(--cf-radio-button-border)",
    buttonBorderColorActive: "var(--cf-radio-button-border-active)",
    buttonBorderColorHover: "var(--cf-radio-button-border-hover)",
    buttonColor: "var(--cf-radio-button-bg)",
    buttonColorActive: "var(--cf-radio-button-bg-active)",
    buttonColorHover: "var(--cf-radio-button-bg)",
    buttonTextColor: "var(--cf-radio-text-color)",
    buttonTextColorActive: "#fff",
    buttonTextColorHover: "var(--cf-radio-text-color)",
    colorDisabled: "var(--cf-radio-dot-color-disabled)",

    dotColorActive: "var(--cf-radio-dot-color-active)",
    dotColorDisabled: "var(--cf-radio-dot-color-disabled)",

    labelTextColor: "var(--cf-radio-text-color)",
    labelTextColorDisabled: "var(--cf-radio-text-color-disabled)",

    radioColor: "var(--cf-radio-dot-color)",
    radioColorActive: "var(--cf-radio-dot-color-active)",
    radioColorDisabled: "var(--cf-radio-dot-color-disabled)",
    radioColorHover: "var(--cf-radio-dot-color)",

    radioDotColorActive: "#fff",
    radioDotColorDisabled: "var(--cf-radio-text-color-disabled)",
  },
  Select: {
    peers: {
      InternalSelection: {
        border: "1px solid var(--cf-field-border)",
        borderActive: "1px solid var(--cf-field-border-focus)",
        borderFocus: "1px solid var(--cf-field-border-focus)",
        borderHover: "1px solid var(--cf-field-border-hover)",
        boxShadowFocus: "var(--cf-field-ring)",
        caretColor: "var(--cf-caret)",
        clearColor: "var(--cf-icon)",
        clearColorHover: "var(--cf-field-text)",
        color: "var(--cf-field-bg)",
        placeholderColor: "var(--cf-field-placeholder)",
        textColor: "var(--cf-field-text)",
      },

      InternalSelectMenu: {
        actionDividerColor: "var(--cf-dropdown-divider)",
        color: "var(--cf-dropdown-bg)",
        groupHeaderTextColor: "var(--cf-text-3)",

        optionCheckColor: "oklch(98% 0.01 260)",
        optionColorActive: "var(--cf-dropdown-option-active-bg)",
        optionColorActivePending: "oklch(33% 0.02 260)",

        optionColorPending: "var(--cf-dropdown-option-hover-bg)",
        optionOpacityDisabled: "var(--cf-dropdown-option-disabled-opacity)",

        optionTextColor: "var(--cf-dropdown-option-text)",
        optionTextColorActive: "var(--cf-dropdown-option-text-active)",
        optionTextColorDisabled: "var(--cf-text-3)",
        optionTextColorPressed: "var(--cf-dropdown-option-text-hover)",
      },
    },
  },
  Tag: {
    border: "1px solid var(--cf-tag-border)",
    closeIconColor: "var(--cf-tag-close)",
    closeIconColorHover: "var(--cf-tag-close-hover)",
    closeIconColorPressed: "var(--cf-tag-close-hover)",
    color: "var(--cf-tag-bg)",

    colorCheckable: "var(--cf-tag-bg)",
    colorHoverCheckable: "color-mix(in oklab, var(--cf-tag-bg) 85%, black)",
    colorPressedCheckable: "color-mix(in oklab, var(--cf-tag-bg) 75%, black)",
    textColor: "var(--cf-tag-text)",
  },
};
</script>
