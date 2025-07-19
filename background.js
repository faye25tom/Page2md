// 后台脚本，处理下载和其他后台任务

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadMarkdown') {
    downloadMarkdown(request.markdown, request.filename);
    sendResponse({ success: true });
  } else if (request.action === 'reopenPopup') {
    // 当用户选择元素后，我们无法直接重新打开popup
    // 但我们可以通知用户点击扩展图标
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showNotification',
          message: '内容已选中，请点击扩展图标查看结果'
        });
      }
    });
    sendResponse({ success: true });
  } else if (request.action === 'elementSelected') {
    // 记录元素已被选中，以便popup重新打开时可以获取
    chrome.storage.local.set({ elementSelected: true });
    sendResponse({ success: true });
  } else if (request.action === 'processSelectedElement') {
    // 当用户点击悬浮按钮时，打开popup并处理选中的元素
    chrome.storage.local.set({ elementSelected: true, autoProcess: true });
    
    // 尝试打开popup
    try {
      chrome.action.openPopup();
    } catch (error) {
      // 如果无法直接打开popup，通知用户点击扩展图标
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'showNotification',
            message: '请点击浏览器工具栏中的Page2md图标查看结果'
          });
        }
      });
    }
    
    sendResponse({ success: true });
  }
  return true;
});

// 下载Markdown文件
function downloadMarkdown(markdown, filename) {
  // 如果没有提供文件名，使用默认文件名
  if (!filename) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    filename = `page2md_${dateStr}.md`;
  }
  
  // 确保文件名有.md扩展名
  if (!filename.endsWith('.md')) {
    filename += '.md';
  }
  
  try {
    // 创建Blob对象
    const blob = new Blob([markdown], { type: 'text/plain' }); // 使用text/plain而不是text/markdown，兼容性更好
    const url = URL.createObjectURL(blob);
    
    console.log('准备下载文件:', filename, '内容长度:', markdown.length);
    
    // 使用chrome.downloads API下载文件
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载错误:', chrome.runtime.lastError);
        // 通知popup下载失败
        chrome.runtime.sendMessage({
          action: 'downloadError',
          error: chrome.runtime.lastError.message || '下载失败'
        });
      } else if (downloadId === undefined) {
        console.error('下载ID未定义，可能下载被取消或失败');
        chrome.runtime.sendMessage({
          action: 'downloadError',
          error: '下载被取消或失败'
        });
      } else {
        console.log('下载已开始，ID:', downloadId);
        // 下载完成后释放URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  } catch (error) {
    console.error('创建下载时出错:', error);
    chrome.runtime.sendMessage({
      action: 'downloadError',
      error: error.message || '创建下载时出错'
    });
  }
}