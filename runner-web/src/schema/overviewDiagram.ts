// Сводная Mermaid-диаграмма «вся модель DSL на одном экране».
// Рендерится в SchemaView.OverviewPanel.
//
// При клике на узел вызывается коллбек, передаваемый Mermaid через ConfigurableSecurity.
// (см. SchemaView; здесь мы только описываем граф.)

export const overviewDiagramSource = `flowchart LR
  classDef root      fill:#e3edff,stroke:#2d6cdf,color:#13315c,stroke-width:1.5px
  classDef section   fill:#f5f6f8,stroke:#a3a8b5,color:#1f2330
  classDef step      fill:#fff7e0,stroke:#cf9b1c,color:#5b3f00
  classDef action    fill:#e8f6ee,stroke:#2e8b57,color:#0e3b22
  classDef runtime   fill:#fde8e6,stroke:#c0392b,color:#5e1813,stroke-dasharray: 4 3
  classDef scalar    fill:#fff,stroke:#a3a8b5,color:#6a7081

  subgraph Design["📋 Дизайн-тайм (DSL JSON, валидируется JSON Schema)"]
    direction LR
    Scenario["Scenario&nbsp;(root)<br/><i>dslVersion · metadata · steps[] · initialStepId</i>"]:::root

    Metadata["metadata<br/><i>scenarioGuid · version · name</i>"]:::section
    Scalars["Scalars<br/><i>StepId · OptionId · Label · ScenarioGuid</i>"]:::scalar

    subgraph Steps["Step (oneOf 8)"]
      direction TB
      RB["RadioButton"]:::step
      CB["Checkbox"]:::step
      SE["Select"]:::step
      CM["Comment"]:::step
      IM["Image"]:::step
      DT["Datetime"]:::step
      BT["Button"]:::step
      CS["CallScenario<br/><sub>design-time only</sub>"]:::step
    end

    Transitions["Transitions<br/><i>rules[] + default</i>"]:::section
    Rule["Rule<br/><i>when (JSONLogic) → goto · actions[]</i>"]:::section

    subgraph Actions["Action (oneOf 5)"]
      direction TB
      AS["assign"]:::action
      CMc["callMacro"]:::action
      GR["generateReport"]:::action
      ES["escalate"]:::action
      FN["finish"]:::action
    end

    Option["Option<br/><i>id · label · hint</i>"]:::scalar
  end

  subgraph Runtime["⚙️ Runtime (производное от прохождения, НЕ часть DSL)"]
    direction LR
    Result["scenarioResult"]:::runtime
    State["state{}<br/><i>stepId → value · answeredAt</i>"]:::runtime
    History["history[]<br/><i>append-only журнал</i>"]:::runtime
    Attachments["attachments[]<br/><i>side-таблица<br/>для Image</i>"]:::runtime
  end

  Scenario --> Metadata
  Scenario --> Steps
  Scenario --> Scalars

  Steps --> Transitions
  Transitions --> Rule
  Rule --> Actions
  Rule -.JSONLogic against state.-> State

  RB --> Option
  CB --> Option
  SE --> Option

  Result --> State
  Result --> History
  Result --> Attachments
  IM -.id'ы вложений.-> Attachments

  CS -.server inline-resolve.-> Steps

  click Scenario "#schema/root" "Перейти к корню"
  click Metadata "#schema/metadata" "Перейти к metadata"
  click Steps "#schema/steps" "Все 8 типов шагов"
  click RB "#schema/step:RadioButton" "RadioButton"
  click CB "#schema/step:Checkbox" "Checkbox"
  click SE "#schema/step:Select" "Select"
  click CM "#schema/step:Comment" "Comment"
  click IM "#schema/step:Image" "Image"
  click DT "#schema/step:Datetime" "Datetime"
  click BT "#schema/step:Button" "Button"
  click CS "#schema/step:CallScenario" "CallScenario"
  click Transitions "#schema/transitions" "Transitions"
  click Rule "#schema/transitions:rule" "Rule"
  click Actions "#schema/actions" "Все 5 actions"
  click AS "#schema/action:assign" "assign"
  click CMc "#schema/action:callMacro" "callMacro"
  click GR "#schema/action:generateReport" "generateReport"
  click ES "#schema/action:escalate" "escalate"
  click FN "#schema/action:finish" "finish"
  click Option "#schema/option" "Option"
  click Result "#schema/result" "scenarioResult"
  click State "#schema/result.state" "state{}"
  click History "#schema/result.history" "history[]"
  click Attachments "#schema/result.attachments" "attachments[]"
  click Scalars "#schema/scalars" "Базовые типы"
`;
