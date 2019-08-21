// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { JupyterFrontEnd } from '@jupyterlab/application';

import { ICommandPalette, WidgetTracker } from '@jupyterlab/apputils';

import { CodeEditor } from '@jupyterlab/codeeditor';

import { IConsoleTracker } from '@jupyterlab/console';

import {
  ISettingRegistry,
  MarkdownCodeBlocks,
  PathExt
} from '@jupyterlab/coreutils';

import { IDocumentWidget } from '@jupyterlab/docregistry';

import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { FileEditor } from '@jupyterlab/fileeditor';

import { ILauncher } from '@jupyterlab/launcher';

import {
  IEditMenu,
  IFileMenu,
  IMainMenu,
  IRunMenu,
  IViewMenu
} from '@jupyterlab/mainmenu';

import { CommandRegistry } from '@phosphor/commands';

import { JSONObject, ReadonlyJSONObject } from '@phosphor/coreutils';

import { Menu } from '@phosphor/widgets';

/**
 * The command IDs used by the fileeditor plugin.
 */
export namespace CommandIDs {
  export const createNew = 'fileeditor:create-new';

  export const createNewMarkdown = 'fileeditor:create-new-markdown-file';

  export const changeFontSize = 'fileeditor:change-font-size';

  export const lineNumbers = 'fileeditor:toggle-line-numbers';

  export const lineWrap = 'fileeditor:toggle-line-wrap';

  export const changeTabs = 'fileeditor:change-tabs';

  export const matchBrackets = 'fileeditor:toggle-match-brackets';

  export const autoClosingBrackets = 'fileeditor:toggle-autoclosing-brackets';

  export const createConsole = 'fileeditor:create-console';

  export const runCode = 'fileeditor:run-code';

  export const runAllCode = 'fileeditor:run-all';

  export const markdownPreview = 'fileeditor:markdown-preview';
}

/**
 * The class name for the text editor icon from the default theme.
 */
export const EDITOR_ICON_CLASS = 'jp-MaterialIcon jp-TextEditorIcon';

/**
 * The class name for the text editor icon from the default theme.
 */
export const MARKDOWN_ICON_CLASS = 'jp-MarkdownIcon';

/**
 * The name of the factory that creates editor widgets.
 */
export const FACTORY = 'Editor';

/**
 * A utility class for adding commands and menu items,
 * for use by the File Editor extension or other Editor extensions.
 */
export default class Commands {
  /**
   * Accessor function that returns the createConsole function for use by Create Console commands
   */
  private static getCreateConsoleFunction(
    commands: CommandRegistry
  ): (
    widget: IDocumentWidget<FileEditor>,
    args?: ReadonlyJSONObject
  ) => Promise<void> {
    return async function createConsole(
      widget: IDocumentWidget<FileEditor>,
      args?: ReadonlyJSONObject
    ): Promise<void> {
      const options = args || {};
      const console = await commands.execute('console:create', {
        activate: options['activate'],
        name: widget.context.contentsModel.name,
        path: widget.context.path,
        preferredLanguage: widget.context.model.defaultKernelLanguage,
        ref: widget.id,
        insertMode: 'split-bottom'
      });

      widget.context.pathChanged.connect((sender, value) => {
        console.session.setPath(value);
        console.session.setName(widget.context.contentsModel.name);
      });
    };
  }

  /**
   * Wrapper function for adding the default File Editor commands
   */
  static addCommands(
    commands: CommandRegistry,
    config: CodeEditor.IConfig,
    settingRegistry: ISettingRegistry,
    id: string,
    isEnabled: () => boolean,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>,
    browserFactory: IFileBrowserFactory
  ) {
    // Add a command to change font size.
    this.addChangeFontSizeCommand(commands, config, settingRegistry, id);

    this.addLineNumbersCommand(
      commands,
      config,
      settingRegistry,
      id,
      isEnabled
    );

    this.addWordWrapCommand(commands, config, settingRegistry, id, isEnabled);

    this.addChangeTabsCommand(commands, config, settingRegistry, id);

    this.addMatchBracketsCommand(
      commands,
      config,
      settingRegistry,
      id,
      isEnabled
    );

    this.addAutoClosingBracketsCommand(commands, config, settingRegistry, id);

    this.addCreateConsoleCommand(commands, tracker, isEnabled);

    this.addRunCodeCommand(commands, tracker, isEnabled);

    this.addRunAllCodeCommand(commands, tracker, isEnabled);

    this.addMarkdownPreviewCommand(commands, tracker);

    // Add a command for creating a new text file.
    this.addCreateNewCommand(commands, browserFactory);

    // Add a command for creating a new Markdown file.
    this.addCreateNewMarkdownCommand(commands, browserFactory);
  }

  /**
   * Add a command to change font size for File Editor
   */
  static addChangeFontSizeCommand(
    commands: CommandRegistry,
    config: CodeEditor.IConfig,
    settingRegistry: ISettingRegistry,
    id: string
  ) {
    commands.addCommand(CommandIDs.changeFontSize, {
      execute: args => {
        const delta = Number(args['delta']);
        if (Number.isNaN(delta)) {
          console.error(
            `${CommandIDs.changeFontSize}: delta arg must be a number`
          );
          return;
        }
        const style = window.getComputedStyle(document.documentElement);
        const cssSize = parseInt(
          style.getPropertyValue('--jp-code-font-size'),
          10
        );
        const currentSize = config.fontSize || cssSize;
        config.fontSize = currentSize + delta;
        return settingRegistry
          .set(id, 'editorConfig', (config as unknown) as JSONObject)
          .catch((reason: Error) => {
            console.error(`Failed to set ${id}: ${reason.message}`);
          });
      },
      label: args => args['name'] as string
    });
  }

  /**
   * Add the Line Numbers command
   */
  static addLineNumbersCommand(
    commands: CommandRegistry,
    config: CodeEditor.IConfig,
    settingRegistry: ISettingRegistry,
    id: string,
    isEnabled: () => boolean
  ) {
    commands.addCommand(CommandIDs.lineNumbers, {
      execute: () => {
        config.lineNumbers = !config.lineNumbers;
        return settingRegistry
          .set(id, 'editorConfig', (config as unknown) as JSONObject)
          .catch((reason: Error) => {
            console.error(`Failed to set ${id}: ${reason.message}`);
          });
      },
      isEnabled,
      isToggled: () => config.lineNumbers,
      label: 'Line Numbers'
    });
  }

  /**
   * Add the Word Wrap command
   */
  static addWordWrapCommand(
    commands: CommandRegistry,
    config: CodeEditor.IConfig,
    settingRegistry: ISettingRegistry,
    id: string,
    isEnabled: () => boolean
  ) {
    type wrappingMode = 'on' | 'off' | 'wordWrapColumn' | 'bounded';

    commands.addCommand(CommandIDs.lineWrap, {
      execute: args => {
        config.lineWrap = (args['mode'] as wrappingMode) || 'off';
        return settingRegistry
          .set(id, 'editorConfig', (config as unknown) as JSONObject)
          .catch((reason: Error) => {
            console.error(`Failed to set ${id}: ${reason.message}`);
          });
      },
      isEnabled,
      isToggled: args => {
        const lineWrap = (args['mode'] as wrappingMode) || 'off';
        return config.lineWrap === lineWrap;
      },
      label: 'Word Wrap'
    });
  }

  /**
   * Add command for changing tabs size or type in File Editor
   */
  static addChangeTabsCommand(
    commands: CommandRegistry,
    config: CodeEditor.IConfig,
    settingRegistry: ISettingRegistry,
    id: string
  ) {
    commands.addCommand(CommandIDs.changeTabs, {
      label: args => args['name'] as string,
      execute: args => {
        config.tabSize = (args['size'] as number) || 4;
        config.insertSpaces = !!args['insertSpaces'];
        return settingRegistry
          .set(id, 'editorConfig', (config as unknown) as JSONObject)
          .catch((reason: Error) => {
            console.error(`Failed to set ${id}: ${reason.message}`);
          });
      },
      isToggled: args => {
        const insertSpaces = !!args['insertSpaces'];
        const size = (args['size'] as number) || 4;
        return config.insertSpaces === insertSpaces && config.tabSize === size;
      }
    });
  }

  /**
   * Add the Match Brackets command
   */
  static addMatchBracketsCommand(
    commands: CommandRegistry,
    config: CodeEditor.IConfig,
    settingRegistry: ISettingRegistry,
    id: string,
    isEnabled: () => boolean
  ) {
    commands.addCommand(CommandIDs.matchBrackets, {
      execute: () => {
        config.matchBrackets = !config.matchBrackets;
        return settingRegistry
          .set(id, 'editorConfig', (config as unknown) as JSONObject)
          .catch((reason: Error) => {
            console.error(`Failed to set ${id}: ${reason.message}`);
          });
      },
      label: 'Match Brackets',
      isEnabled,
      isToggled: () => config.matchBrackets
    });
  }

  /**
   * Add the Auto Close Brackets for Text Editor command
   */
  static addAutoClosingBracketsCommand(
    commands: CommandRegistry,
    config: CodeEditor.IConfig,
    settingRegistry: ISettingRegistry,
    id: string
  ) {
    commands.addCommand(CommandIDs.autoClosingBrackets, {
      execute: () => {
        config.autoClosingBrackets = !config.autoClosingBrackets;
        return settingRegistry
          .set(id, 'editorConfig', (config as unknown) as JSONObject)
          .catch((reason: Error) => {
            console.error(`Failed to set ${id}: ${reason.message}`);
          });
      },
      label: 'Auto Close Brackets for Text Editor',
      isToggled: () => config.autoClosingBrackets
    });
  }

  /**
   * Add the Create Console for Editor command
   */
  static addCreateConsoleCommand(
    commands: CommandRegistry,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>,
    isEnabled: () => boolean
  ) {
    commands.addCommand(CommandIDs.createConsole, {
      execute: args => {
        const widget = tracker.currentWidget;

        if (!widget) {
          return;
        }

        return Commands.getCreateConsoleFunction(commands)(widget, args);
      },
      isEnabled,
      label: 'Create Console for Editor'
    });
  }

  /**
   * Add the Run Code command
   */
  static addRunCodeCommand(
    commands: CommandRegistry,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>,
    isEnabled: () => boolean
  ) {
    commands.addCommand(CommandIDs.runCode, {
      execute: () => {
        // Run the appropriate code, taking into account a ```fenced``` code block.
        const widget = tracker.currentWidget.content;

        if (!widget) {
          return;
        }

        let code = '';
        const editor = widget.editor;
        const path = widget.context.path;
        const extension = PathExt.extname(path);
        const selection = editor.getSelection();
        const { start, end } = selection;
        let selected = start.column !== end.column || start.line !== end.line;

        if (selected) {
          // Get the selected code from the editor.
          const start = editor.getOffsetAt(selection.start);
          const end = editor.getOffsetAt(selection.end);

          code = editor.model.value.text.substring(start, end);
        } else if (MarkdownCodeBlocks.isMarkdown(extension)) {
          const { text } = editor.model.value;
          const blocks = MarkdownCodeBlocks.findMarkdownCodeBlocks(text);

          for (let block of blocks) {
            if (block.startLine <= start.line && start.line <= block.endLine) {
              code = block.code;
              selected = true;
              break;
            }
          }
        }

        if (!selected) {
          // no selection, submit whole line and advance
          code = editor.getLine(selection.start.line);
          const cursor = editor.getCursorPosition();
          if (cursor.line + 1 === editor.lineCount) {
            let text = editor.model.value.text;
            editor.model.value.text = text + '\n';
          }
          editor.setCursorPosition({
            line: cursor.line + 1,
            column: cursor.column
          });
        }

        const activate = false;
        if (code) {
          return commands.execute('console:inject', { activate, code, path });
        } else {
          return Promise.resolve(void 0);
        }
      },
      isEnabled,
      label: 'Run Code'
    });
  }

  /**
   * Add the Run All Code command
   */
  static addRunAllCodeCommand(
    commands: CommandRegistry,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>,
    isEnabled: () => boolean
  ) {
    commands.addCommand(CommandIDs.runAllCode, {
      execute: () => {
        let widget = tracker.currentWidget.content;

        if (!widget) {
          return;
        }

        let code = '';
        let editor = widget.editor;
        let text = editor.model.value.text;
        let path = widget.context.path;
        let extension = PathExt.extname(path);

        if (MarkdownCodeBlocks.isMarkdown(extension)) {
          // For Markdown files, run only code blocks.
          const blocks = MarkdownCodeBlocks.findMarkdownCodeBlocks(text);
          for (let block of blocks) {
            code += block.code;
          }
        } else {
          code = text;
        }

        const activate = false;
        if (code) {
          return commands.execute('console:inject', { activate, code, path });
        } else {
          return Promise.resolve(void 0);
        }
      },
      isEnabled,
      label: 'Run All Code'
    });
  }

  /**
   * Add the command
   */
  static addMarkdownPreviewCommand(
    commands: CommandRegistry,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>
  ) {
    commands.addCommand(CommandIDs.markdownPreview, {
      execute: () => {
        let widget = tracker.currentWidget;
        if (!widget) {
          return;
        }
        let path = widget.context.path;
        return commands.execute('markdownviewer:open', {
          path,
          options: {
            mode: 'split-right'
          }
        });
      },
      isVisible: () => {
        let widget = tracker.currentWidget;
        return (
          (widget && PathExt.extname(widget.context.path) === '.md') || false
        );
      },
      label: 'Show Markdown Preview'
    });
  }

  /**
   * Function to create a new untitled text file, given the current working directory.
   */
  private static createNew = (
    commands: CommandRegistry,
    cwd: string,
    ext: string = 'txt'
  ) => {
    return commands
      .execute('docmanager:new-untitled', {
        path: cwd,
        type: 'file',
        ext
      })
      .then(model => {
        return commands.execute('docmanager:open', {
          path: model.path,
          factory: FACTORY
        });
      });
  };

  /**
   * Add the New File command
   */
  static addCreateNewCommand(
    commands: CommandRegistry,
    browserFactory: IFileBrowserFactory
  ) {
    commands.addCommand(CommandIDs.createNew, {
      label: args => (args['isPalette'] ? 'New Text File' : 'Text File'),
      caption: 'Create a new text file',
      iconClass: args => (args['isPalette'] ? '' : EDITOR_ICON_CLASS),
      execute: args => {
        let cwd = args['cwd'] || browserFactory.defaultBrowser.model.path;
        return this.createNew(commands, cwd as string);
      }
    });
  }

  /**
   * Add the New Markdown File command
   */
  static addCreateNewMarkdownCommand(
    commands: CommandRegistry,
    browserFactory: IFileBrowserFactory
  ) {
    commands.addCommand(CommandIDs.createNewMarkdown, {
      label: args =>
        args['isPalette'] ? 'New Markdown File' : 'Markdown File',
      caption: 'Create a new markdown file',
      iconClass: args => (args['isPalette'] ? '' : MARKDOWN_ICON_CLASS),
      execute: args => {
        let cwd = args['cwd'] || browserFactory.defaultBrowser.model.path;
        return this.createNew(commands, cwd as string, 'md');
      }
    });
  }

  /**
   * Wrapper function for adding the default launcher items for File Editor
   */
  static addLauncherItems(launcher: ILauncher) {
    this.addCreateNewToLauncher(launcher);

    this.addCreateNewMarkdownToLauncher(launcher);
  }

  /**
   * Add Create New Text File to the Launcher
   */
  static addCreateNewToLauncher(launcher: ILauncher) {
    launcher.add({
      command: CommandIDs.createNew,
      category: 'Other',
      rank: 1
    });
  }

  /**
   * Add Create New Markdown to the Launcher
   */
  static addCreateNewMarkdownToLauncher(launcher: ILauncher) {
    launcher.add({
      command: CommandIDs.createNewMarkdown,
      category: 'Other',
      rank: 2
    });
  }

  /**
   * Wrapper function for adding the default items to the File Editor palette
   */
  static addPaletteItems(palette: ICommandPalette) {
    this.addChangeTabsCommandsToPalette(palette);

    this.addCreateNewCommandToPalette(palette);

    this.addCreateNewMarkdownCommandToPalette(palette);

    this.addChangeFontSizeCommandsToPalette(palette);
  }

  /**
   * The category for File Editor palette commands for use in addToPalette functions
   */
  private static paletteCategory = 'Text Editor';

  /**
   * Add commands to change the tab indentation to the File Editor palette
   */
  static addChangeTabsCommandsToPalette(palette: ICommandPalette) {
    let args: JSONObject = {
      insertSpaces: false,
      size: 4,
      name: 'Indent with Tab'
    };
    let command = 'fileeditor:change-tabs';
    palette.addItem({ command, args, category: this.paletteCategory });

    for (let size of [1, 2, 4, 8]) {
      let args: JSONObject = {
        insertSpaces: true,
        size,
        name: `Spaces: ${size} `
      };
      palette.addItem({ command, args, category: this.paletteCategory });
    }
  }

  /**
   * Add a Create New File command to the File Editor palette
   */
  static addCreateNewCommandToPalette(palette: ICommandPalette) {
    palette.addItem({
      command: CommandIDs.createNew,
      args: { isPalette: true },
      category: this.paletteCategory
    });
  }

  /**
   * Add a Create New Markdown command to the File Editor palette
   */
  static addCreateNewMarkdownCommandToPalette(palette: ICommandPalette) {
    palette.addItem({
      command: CommandIDs.createNewMarkdown,
      args: { isPalette: true },
      category: this.paletteCategory
    });
  }

  /**
   * Add commands to change the font size to the File Editor palette
   */
  static addChangeFontSizeCommandsToPalette(palette: ICommandPalette) {
    let command = CommandIDs.changeFontSize;

    let args = { name: 'Increase Font Size', delta: 1 };
    palette.addItem({ command, args, category: this.paletteCategory });

    args = { name: 'Decrease Font Size', delta: -1 };
    palette.addItem({ command, args, category: this.paletteCategory });
  }

  /**
   * Wrapper function for adding the default menu items for File Editor
   */
  static addMenuItems(
    menu: IMainMenu,
    commands: CommandRegistry,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>,
    consoleTracker: IConsoleTracker
  ) {
    // Add the editing commands to the settings menu.
    this.addEditingCommandsToSettingsMenu(menu, commands);

    // Add new text file creation to the file menu.
    this.addCreateNewFileToFileMenu(menu);

    // Add new markdown file creation to the file menu.
    this.addCreateNewMarkdownFileToFileMenu(menu);

    // Add undo/redo hooks to the edit menu.
    this.addUndoRedoToEditMenu(menu, tracker);

    // Add editor view options.
    this.addEditorViewerToViewMenu(menu, tracker);

    // Add a console creator the the file menu.
    this.addConsoleCreatorToFileMenu(menu, commands, tracker);

    // Add a code runner to the run menu.
    this.addCodeRunnersToRunMenu(menu, commands, tracker, consoleTracker);
  }

  /**
   * Add File Editor editing commands to the Settings menu, including:
   * Indent with Tab, Tab Spaces, Change Font Size, and auto closing brackets
   */
  static addEditingCommandsToSettingsMenu(
    menu: IMainMenu,
    commands: CommandRegistry
  ) {
    const tabMenu = new Menu({ commands });
    tabMenu.title.label = 'Text Editor Indentation';
    let args: JSONObject = {
      insertSpaces: false,
      size: 4,
      name: 'Indent with Tab'
    };
    let command = 'fileeditor:change-tabs';
    tabMenu.addItem({ command, args });

    for (let size of [1, 2, 4, 8]) {
      let args: JSONObject = {
        insertSpaces: true,
        size,
        name: `Spaces: ${size} `
      };
      tabMenu.addItem({ command, args });
    }

    menu.settingsMenu.addGroup(
      [
        {
          command: CommandIDs.changeFontSize,
          args: { name: 'Increase Text Editor Font Size', delta: +1 }
        },
        {
          command: CommandIDs.changeFontSize,
          args: { name: 'Decrease Text Editor Font Size', delta: -1 }
        },
        { type: 'submenu', submenu: tabMenu },
        { command: CommandIDs.autoClosingBrackets }
      ],
      30
    );
  }

  /**
   * Add a Create New File command to the File menu
   */
  static addCreateNewFileToFileMenu(menu: IMainMenu) {
    menu.fileMenu.newMenu.addGroup([{ command: CommandIDs.createNew }], 30);
  }

  /**
   * Add a Create New Markdown File command to the File menu
   */
  static addCreateNewMarkdownFileToFileMenu(menu: IMainMenu) {
    menu.fileMenu.newMenu.addGroup(
      [{ command: CommandIDs.createNewMarkdown }],
      30
    );
  }

  /**
   * Add File Editor undo and redo widgets to the Edit menu
   */
  static addUndoRedoToEditMenu(
    menu: IMainMenu,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>
  ) {
    menu.editMenu.undoers.add({
      tracker,
      undo: widget => {
        widget.content.editor.undo();
      },
      redo: widget => {
        widget.content.editor.redo();
      }
    } as IEditMenu.IUndoer<IDocumentWidget<FileEditor>>);
  }

  /**
   * Add a File Editor editor viewer to the View Menu
   */
  static addEditorViewerToViewMenu(
    menu: IMainMenu,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>
  ) {
    menu.viewMenu.editorViewers.add({
      tracker,
      toggleLineNumbers: widget => {
        const lineNumbers = !widget.content.editor.getOption('lineNumbers');
        widget.content.editor.setOption('lineNumbers', lineNumbers);
      },
      toggleWordWrap: widget => {
        const oldValue = widget.content.editor.getOption('lineWrap');
        const newValue = oldValue === 'off' ? 'on' : 'off';
        widget.content.editor.setOption('lineWrap', newValue);
      },
      toggleMatchBrackets: widget => {
        const matchBrackets = !widget.content.editor.getOption('matchBrackets');
        widget.content.editor.setOption('matchBrackets', matchBrackets);
      },
      lineNumbersToggled: widget =>
        widget.content.editor.getOption('lineNumbers'),
      wordWrapToggled: widget =>
        widget.content.editor.getOption('lineWrap') !== 'off',
      matchBracketsToggled: widget =>
        widget.content.editor.getOption('matchBrackets')
    } as IViewMenu.IEditorViewer<IDocumentWidget<FileEditor>>);
  }

  /**
   * Add a File Editor console creator to the File menu
   */
  static addConsoleCreatorToFileMenu(
    menu: IMainMenu,
    commands: CommandRegistry,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>
  ) {
    let createConsole: (
      widget: IDocumentWidget<FileEditor>
    ) => Promise<void> = this.getCreateConsoleFunction(commands);
    menu.fileMenu.consoleCreators.add({
      tracker,
      name: 'Editor',
      createConsole
    } as IFileMenu.IConsoleCreator<IDocumentWidget<FileEditor>>);
  }

  /**
   * Add a File Editor code runner to the Run menu
   */
  static addCodeRunnersToRunMenu(
    menu: IMainMenu,
    commands: CommandRegistry,
    tracker: WidgetTracker<IDocumentWidget<FileEditor>>,
    consoleTracker: IConsoleTracker
  ) {
    menu.runMenu.codeRunners.add({
      tracker,
      noun: 'Code',
      isEnabled: current =>
        !!consoleTracker.find(c => c.session.path === current.context.path),
      run: () => commands.execute(CommandIDs.runCode),
      runAll: () => commands.execute(CommandIDs.runAllCode),
      restartAndRunAll: current => {
        const console = consoleTracker.find(
          console => console.session.path === current.context.path
        );
        if (console) {
          return console.session.restart().then(restarted => {
            if (restarted) {
              void commands.execute(CommandIDs.runAllCode);
            }
            return restarted;
          });
        }
      }
    } as IRunMenu.ICodeRunner<IDocumentWidget<FileEditor>>);
  }

  /**
   * Wrapper function for adding the default items to the File Editor context menu
   */
  static addContextMenuItems(app: JupyterFrontEnd) {
    this.addCreateConsoleToContextMenu(app);
    this.addMarkdownPreviewToContextMenu(app);
  }

  /**
   * Add a Create Console item to the File Editor context menu
   */
  static addCreateConsoleToContextMenu(app: JupyterFrontEnd) {
    app.contextMenu.addItem({
      command: CommandIDs.createConsole,
      selector: '.jp-FileEditor'
    });
  }

  /**
   * Add a Markdown Preview item to the File Editor context menu
   */
  static addMarkdownPreviewToContextMenu(app: JupyterFrontEnd) {
    app.contextMenu.addItem({
      command: CommandIDs.markdownPreview,
      selector: '.jp-FileEditor'
    });
  }
}
