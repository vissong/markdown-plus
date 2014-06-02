(function(document) {
    var MenuTree = {
        init: function() {
            var titles = MenuTree.findTitle();

            MenuTree.build(titles.list);
        },

        // 找到标题，并形成层级关系
        findTitle: function() {
            var headings = $('h1,h2,h3,h4,h5,h6'),
                titles = {
                    topLevle: 0,
                    list: []
                }

            headings.each(function(k, v) {
                $(v).attr('id', 'head' + k);
                titles.list.push({
                    id: 'head' + k,
                    text: $(v).text(),
                    level: $(v).prop('nodeName').replace('H', '')
                });
            });

            return titles;
        },

        toggle: function(el) {
            var wrap = document.getElementById('MenuList').parentNode;

            if(wrap.style.display != 'none') {
                el.innerHTML = 'Menu ON';
                wrap.style.display = 'none';
            } else {
                el.innerHTML = 'OFF';
                wrap.style.display = '';
            }
        },

        build: function(list) {
            var html = [];

            console.log(list);
            html.push('<p>目录，打印时自动隐藏 <a href="javascript:;" id="toggle">折叠</a></p>');
            html.push('<dl id="menu_content">');
            for(var i = 0, len = list.length; i<len; ++i) {
                var v = list[i];
                console.log(v);
                html.push('<dd class="cate cateLevel' + v.level + '"><a _jump="' + v.id + '" href="javascript:return false;">' + v.text + '</a></dd>');
            }
            html.push('</dl>');

            var wrap = document.createElement('div');
            wrap.className = 'menutree noprint';
            wrap.innerHTML = html.join('');

            document.body.appendChild(wrap);

            // 目录跳转
            $('.menutree .cate a').bind('click', function() {
                var jumpId = $(this).attr('_jump');
                console.log(jumpId);
                window.scrollTo(0, $('#' + jumpId).offset().top);

                return false;
            });

            // 目录折叠
            $('#toggle').on('click', function() {
                $('#menu_content').toggle();
            });
        }
    };

    var interval, 
        storage = chrome.storage.local;

    function parseMatchPattern(input) {
        if (typeof input !== 'string') {
            return null;
        }
        var match_pattern = '(?:^', 
            regEscape = function(s) {return s.replace(/[[^$.|?*+(){}\\]/g, '\\$&');},  
            result = /^(\*|https?|file|ftp|chrome-extension):\/\//.exec(input);

        // Parse scheme
        if (!result) return null;
        input = input.substr(result[0].length);
        match_pattern += result[1] === '*' ? 'https?://' : result[1] + '://';

        // Parse host if scheme is not `file`
        if (result[1] !== 'file') {
            if (!(result = /^(?:\*|(\*\.)?([^\/*]+))/.exec(input))) return null;
            input = input.substr(result[0].length);
            if (result[0] === '*') {    // host is '*'
                match_pattern += '[^/]+';
            } else {
                if (match[1]) {         // Subdomain wildcard exists
                    match_pattern += '(?:[^/]+\.)?';
                }
                // Append host (escape special regex characters)
                match_pattern += regEscape(match[2]) + '/';
            }
        }
        // Add remainder (path)
        match_pattern += input.split('*').map(regEscape).join('.*');
        match_pattern += '$)';
        return match_pattern;
    }

    // Onload, take the DOM of the page, get the markdown formatted text out and
    // apply the converter.
    function makeHtml(data) {

        marked.setOptions({
          gfm: true,
          tables: true,
          breaks: true,
          pedantic: false,
          sanitize: false,
          smartLists: true, 
          smartypants: false
        });

        // resolve [^1]
        data = data.replace(/\[\^(\d+)\]:(.*)/ig, function(match, num, text) {
            var noteHtml = '&nbsp;&nbsp;' + num + ': ' + text;
            noteHtml += ' <a href="javascript;" class="noteBack" _num="' + num + '">Back</a>';

            noteHtml = '<span id="note' + num + '" style="color:#a2a2a2">' + noteHtml + '</span>';
            return noteHtml;
        });
        data = data.replace(/\[\^(\d+)\]/ig, function(match, num) {
            return '<sup><a id="noteBack' + num + '" class="note" href="javascript:;" _num="' + num + '">' + num + '</a></sup>'
        });

        var html = marked(data);

        // resolve tnm ip
        var links = html.match(/<a.*?href.*?(\d+)\.(\d+)\.(\d+)\.(\d+)(:\d+)?.*?<\/a>/gi) || [];
        for(var i = 0; i<links.length; i++) {
            html = html.replace(links[i], '__LINK_TEMP__'+i);
        }
        html = html.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/ig, function(ip){
            return '<a href="http://tnm2.oa.com/host/home/'+ip+'" target="_blank">'+ip+'</a>';
        });
        for(var i = 0; i<links.length; i++) {
            html =  html.replace('__LINK_TEMP__'+i, links[i]);
        }

        $(document.body).html(html);
        setCodeHighlight();
        bindNoteEvent();

        MenuTree.init();
    }

    function bindNoteEvent() {
        $('.note').each(function() {
            var num = $(this).attr('_num');
            var title = $('#note' + num).text();

            $(this).prop('title', title);
        });

        $('.note').bind('click', function() {
            var num = $(this).attr('_num');
            window.scrollTo(0, $('#note' + num).offset().top);

            return false;
        });

        $('.noteBack').bind('click', function() {
            var num = $(this).attr('_num');
            window.scrollTo(0, $('#noteBack' + num).offset().top);

            return false;
        });
    }

    function getThemeCss(theme) {
        return chrome.extension.getURL('theme/' + theme + '.css');
    }

    function setTheme(theme) {
        var defaultThemes = ['dzplatrd', 'Clearness', 'ClearnessDark', 'Github', 'TopMarks'];

        if($.inArray(theme, defaultThemes) != -1) {
            var link = $('#theme');
            $('#custom-theme').remove();
            if(!link.length) {
                var ss = document.createElement('link');
                ss.rel = 'stylesheet';
                ss.id = 'theme';
                ss.href = getThemeCss(theme);
                document.head.appendChild(ss);
            } else {
                link.attr('href', getThemeCss(theme));
            }
        } else {
            var themePrefix = 'theme_',
                key = themePrefix + theme;
            storage.get(key, function(items) {
                if(items[key]) {
                    $('#theme').remove();
                    var theme = $('#custom-theme');
                    if(!theme.length) {
                        var style = $('<style/>').attr('id', 'custom-theme')
                                        .html(items[key]);
                        $(document.head).append(style);
                    } else {
                        theme.html(items[key]);
                    }
                }
            });
        }
    }

    function setCodeHighlight() {
        hljs.tabReplace = ' ';
        $('pre code').each(function(i, e) {hljs.highlightBlock(e)});
    }

    function stopAutoReload() {
        clearInterval(interval);
    }

    function startAutoReload() {
        stopAutoReload();
        interval = setInterval(function() {
            $.ajax({
                url : location.href, 
                cache : false,
                success : function(data) { 
                    makeHtml(data); 
                }
            });
        }, 3000);
    }

    function render() {
        $.ajax({
            url : location.href, 
            cache : false,
            complete : function(xhr, textStatus) {
                var contentType = xhr.getResponseHeader('Content-Type');
                if(contentType && (contentType.indexOf('html') > -1)) {
                    return;    
                }

                makeHtml(document.body.innerText);

                // 页面上载入 jquery
                var jqueryURL = chrome.extension.getURL('js/jquery.js');
                var link = document.createElement("script");  
                    link.setAttribute("src", jqueryURL);
                    link.setAttribute("type", "text/javascript");
                document.head.appendChild(link);

                // 载入打印css
                var link = document.createElement("link");  
                    link.setAttribute("href", chrome.extension.getURL('noprint.css'));
                    link.setAttribute("rel", "stylesheet");
                    link.setAttribute("media", "print");
                document.head.appendChild(link);

                var specialThemePrefix = 'special_',
                    pageKey = specialThemePrefix + location.href;
                storage.get(['theme', pageKey], function(items) {
                    theme = items.theme ? items.theme : 'dzplatrd';
                    if(items[pageKey]) {
                        theme = items[pageKey];
                    }
                    setTheme(theme);
                });

                storage.get('auto_reload', function(items) {
                    if(items.auto_reload) {
                        startAutoReload();
                    }
                });

                chrome.storage.onChanged.addListener(function(changes, namespace) {
                    for (key in changes) {
                        var value = changes[key];
                        if(key == pageKey) {
                            setTheme(value.newValue);
                        } else if(key == 'theme') {
                            storage.get(pageKey, function(items) {
                                if(!items[pageKey]) {
                                    setTheme(value.newValue);
                                }
                            });
                        } else if(key == 'auto_reload') {
                            if(value.newValue) {
                                startAutoReload();
                            } else {
                                stopAutoReload();
                            }
                        }
                    }
                });
            }
        });
    }

    storage.get('exclude_exts', function(items) {
        var exts = items.exclude_exts;
        if(!exts) {
            render();
            return;
        }

        var parsed = $.map(exts, function(k, v) {
            return parseMatchPattern(v);
        });
        var pattern = new RegExp(parsed.join('|'));
        if(!parsed.length || !pattern.test(location.href)) {
            render();
        }
    });

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
        if(request.method == "getHtml"){
            var html = document.all[0].outerHTML;
            html = html.replace('<head>', '<head><meta http-equiv="Content-Type" content="text/html;charset=UTF-8">');
            sendResponse({data: html, method: "getHtml"});
        }
    });

}(document));
