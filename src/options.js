// 默认设置
const defaultSettings = {
  markdown: {
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    preserveImages: true,
    preserveLinks: true
  },
  content: {
    defaultSelectors: [
      'article',
      'main',
      '.article',
      '.post',
      '.content',
      '.main-content',
      '#content',
      '#main',
      '.article-content',
      '.post-content'
    ],
    excludeSelectors: [
      'nav',
      'header',
      'footer',
      '.navigation',
      '.menu',
      '.sidebar',
      '.comments',
      '.related',
      '.advertisement',
      'script',
      'style',
      'iframe'
    ]
  },
  file: {
    filenameTemplate: '[title]',
    promptFilename: true
  }
};

// DOM元素
const headingStyleSelect = document.getElementById('headingStyle');
const bulletListMarkerSelect = document.getElementById('bulletListMarker');
const codeBlockStyleSelect = document.getElementById('codeBlockStyle');
const preserveImagesCheckbox = document.getElementById('preserveImages');
const preserveLinksCheckbox = document.getElementById('preserveLinks');
const defaultSelectorsTextarea = document.getElementById('defaultSelectors');
const excludeSelectorsTextarea = document.getElementById('excludeSelectors');
const filenameTemplateInput = document.getElementById('filenameTemplate');
const promptFilenameCheckbox = document.getElementById('promptFilename');
const saveSettingsButton = document.getElementById('saveSettings');
const statusDiv = document.getElementById('status');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 添加保存按钮事件监听器
  saveSettingsButton.addEventListener('click', saveSettings);
});

// 加载设置
function loadSettings() {
  chrome.storage.sync.get('settings', (data) => {
    const settings = data.settings || defaultSettings;
    
    // 设置表单值
    headingStyleSelect.value = settings.markdown.headingStyle;
    bulletListMarkerSelect.value = settings.markdown.bulletListMarker;
    codeBlockStyleSelect.value = settings.markdown.codeBlockStyle;
    preserveImagesCheckbox.checked = settings.markdown.preserveImages;
    preserveLinksCheckbox.checked = settings.markdown.preserveLinks;
    
    defaultSelectorsTextarea.value = settings.content.defaultSelectors.join('\n');
    excludeSelectorsTextarea.value = settings.content.excludeSelectors.join('\n');
    
    filenameTemplateInput.value = settings.file.filenameTemplate;
    promptFilenameCheckbox.checked = settings.file.promptFilename;
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    markdown: {
      headingStyle: headingStyleSelect.value,
      bulletListMarker: bulletListMarkerSelect.value,
      codeBlockStyle: codeBlockStyleSelect.value,
      preserveImages: preserveImagesCheckbox.checked,
      preserveLinks: preserveLinksCheckbox.checked
    },
    content: {
      defaultSelectors: defaultSelectorsTextarea.value.split('\n').filter(s => s.trim()),
      excludeSelectors: excludeSelectorsTextarea.value.split('\n').filter(s => s.trim())
    },
    file: {
      filenameTemplate: filenameTemplateInput.value,
      promptFilename: promptFilenameCheckbox.checked
    }
  };
  
  chrome.storage.sync.set({ settings }, () => {
    // 显示保存成功消息
    showStatus('设置已保存', 'success');
  });
}

// 显示状态消息
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  // 3秒后隐藏消息
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}