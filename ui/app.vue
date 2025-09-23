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
  Button: {
    border: "1px dashed var(--cf-field-border)",
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
    iconColor: "var(--cf-icon)",
    itemColorActive: "var(--cf-primary)",
    itemColorIncluded:
      "color-mix(in oklch, var(--cf-primary) 22%, transparent)",

    itemTextColor: "var(--cf-popover-text)",
    itemTextColorActive: "var(--cf-text-1)",
    itemTextColorCurrent: "var(--cf-primary-hover)",
    panelActionDividerColor: "var(--cf-popover-divider)",
    panelBoxShadow: "var(--cf-popover-shadow)",
    panelColor: "var(--cf-popover-bg)",
    panelTextColor: "var(--cf-popover-text)",
    textColor: "var(--cf-popover-text)",
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
