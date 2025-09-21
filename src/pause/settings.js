import React from 'react';
import { Component } from 'react';

import {
  AppDisplaySettingsTab,
  EditorScreen,
  FieldsTab,
  FieldRow,
  FieldLabel,
  FieldControl,
  TelevisionWhiteImage,
  BlurImage,
  GamepadWhiteImage,
  ShaderSettingsTab,
  // ScreenSizeSelect,
  // ScreenControlsSelect,
  // Select,
  Switch,
  WebrcadeContext,
} from '@webrcade/app-common';

export class NesSettingsEditor extends Component {
  constructor() {
    super();
    this.state = {
      tabIndex: null,
      focusGridComps: null,
      values: {},
    };

    this.busy = false;
  }

  componentDidMount() {
    const { emulator } = this.props;


    const values = {
      origBilinearMode: emulator.getPrefs().isBilinearEnabled(),
      bilinearMode: emulator.getPrefs().isBilinearEnabled(),
      origScreenSize: emulator.getPrefs().getScreenSize(),
      screenSize: emulator.getPrefs().getScreenSize(),
    }

    this.shaderService = this.props.emulator.getShadersService();
    this.shaderService.addEditorValues(values);

    this.setState({
      values: values
    });
  }

  render() {
    const { emulator, onClose, showOnScreenControls } = this.props;
    const { tabIndex, values, focusGridComps } = this.state;

    const setFocusGridComps = (comps) => {
      this.setState({ focusGridComps: comps });
    };

    const setValues = (values) => {
      this.setState({ values: values });
    };

    const tabs = [];

    let tab = 0;

    if (emulator.isFdsGame()) {
      tabs.push(          {
        image: GamepadWhiteImage,
        label: 'NES Settings (Session only)',
        content: (
          <NesSettingsTab
            emulator={emulator}
            isActive={tabIndex === tab}
            setFocusGridComps={setFocusGridComps}
            values={values}
            setValues={setValues}
          />
        ),
      });
      tab++;
    }

    tabs.push({
        image: TelevisionWhiteImage,
        label: 'Display Settings',
        content: (
          <AppDisplaySettingsTab
            emulator={emulator}
            isActive={tabIndex === tab}
            showOnScreenControls={showOnScreenControls}
            setFocusGridComps={setFocusGridComps}
            values={values}
            setValues={setValues}
          />
        )
    });
    tab++;

    tabs.push({
      image: BlurImage,
      label: 'Shader Settings',
      content: (
        <ShaderSettingsTab
          shaderService={this.shaderService}
          emulator={emulator}
          isActive={tabIndex === tab}
          setFocusGridComps={setFocusGridComps}
          values={values}
          setValues={setValues}
        />
      )
    });

    return (
      <EditorScreen
        showCancel={true}
        onOk={async () => {
          if (this.busy) return;
          this.busy = true;

          if (values.swapDisk) {
            emulator.flipDisk();
          }

          let change = false;
          if (values.origBilinearMode !== values.bilinearMode) {
            emulator.getPrefs().setBilinearEnabled(values.bilinearMode);
            emulator.updateBilinearFilter();
            change = true;
          }
          if (values.origScreenSize !== values.screenSize) {
            emulator.getPrefs().setScreenSize(values.screenSize);
            emulator.updateScreenSize();
            change = true;
          }
          if (change) {
            emulator.getPrefs().save();
          }

          // Set the shader
          await this.shaderService.setShader(values.shaderId);

          onClose();
        }}
        onClose={onClose}
        focusGridComps={focusGridComps}
        onTabChange={(oldTab, newTab) => this.setState({ tabIndex: newTab })}
        tabs={tabs}
      />
    );
  }
}

class NesSettingsTab extends FieldsTab {
  constructor(props) {
    super(props);
    this.swapDiskRef = React.createRef();
    this.gridComps = [
      [this.swapDiskRef]
    ];
  }

  componentDidUpdate(prevProps, prevState) {
    const { gridComps } = this;
    const { setFocusGridComps } = this.props;
    const { isActive } = this.props;

    if (isActive && isActive !== prevProps.isActive) {
      setFocusGridComps(gridComps);
    }
  }

  render() {
    const { swapDiskRef } = this;
    const { focusGrid } = this.context;
    const { setValues, values } = this.props;

    return (
      <>
        <FieldRow>
          <FieldLabel>Flip disk</FieldLabel>
          <FieldControl>
            <Switch
              ref={swapDiskRef}
              onChange={(e) => {
                setValues({
                  ...values,
                  ...{ swapDisk: e.target.checked },
                })
              }}
              checked={values.swapDisk}
              onPad={(e) => focusGrid.moveFocus(e.type, swapDiskRef)}
            />
          </FieldControl>
        </FieldRow>
      </>
    );
  }
}
NesSettingsTab.contextType = WebrcadeContext;
