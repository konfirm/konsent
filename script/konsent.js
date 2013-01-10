/**
 *       __    Konsent (v0.8.5)- a EU-law cookie consent helper library
 *      /\_\
 *   /\/ / /   Copyright 2012, Konfirm (Rogier Spieker)
 *   \  / /    Releases under the MIT and GPL licenses
 *    \/_/     More information: http://konfirm.net/konsent
 */
;var Konsent = Konsent||new(function(){
	var konsent = this;

	//  initialization
	konsent.init = function(config)
	{
		konsent._enterState(konsent.state.INIT);

		konsent.config = konsent._mergeObjects(config, konsent.defaultConfig);
		konsent.geo    = {code:'',country:'',continent:''};

		konsent.addStateListener(konsent.state.CONFIG, function(){konsent._configure()});

		if (konsent.config.respectDoNotTrack && konsent._doNotTrack())
			return konsent._enterState(konsent.state.DO_NOT_TRACK);

		konsent._leaveState(konsent.state.INIT);
	};
	konsent.delayInit = function(config)
	{
		var call = function(){konsent.init(config);};
		if (typeof window.addStateListener != "undefined")
			window.addStateListener('DOMContentLoaded', call, false);
		else
			window.onload = call;
	};

	//  common methods
	konsent.askUserConsent = function()
	{
		konsent.createConsentInterface();
		if (konsent.config.animate)
		{
			var ctr = konsent.structure.container,
			    h = ctr.offsetHeight || ctr.clientHeight || null;
			if (h)
			{
				ctr.style.height   = '0px';
				ctr.style.overflow = 'hidden';
				konsent._sizeAnimation(ctr, {height:h}, 20);
			}
		}
	};
	konsent.userConsent = function(doAllowTracking)
	{
		konsent.setConsentCookie(doAllowTracking);
	};
	konsent.revokeConsent = function()
	{
		konsent.setConsentCookie(false);
	};
	konsent.setGeoLocation = function(location)
	{
		konsent.geo = location;
		konsent._leaveState(konsent.state.CONFIG);
	};
	konsent.getGeoLocation = function()
	{
		return konsent.geo;
	};

	//  visual appearance
	konsent.getInterfaceStructure = function()
	{
		if (typeof konsent.structure == 'undefined')
		{
			var container = document.body.insertBefore(document.createElement('div'), document.body.firstChild),
				  content = container.appendChild(document.createElement('div')),
				 question = content.appendChild(document.createElement('span')),
				   action = content.appendChild(document.createElement('span')),
				    extra = content.appendChild(document.createElement('div')),
				     more = extra.appendChild(document.createElement('button'));

			konsent.structure = {
				container:container,
				 content:content,
				question:question,
				   extra:extra,
				    more:more,
				  action:action,
				 explain:extra.appendChild(document.createElement('div')),
				 consent:action.appendChild(document.createElement('button')),
				 decline:action.appendChild(document.createElement('button'))
			};
		}
		return konsent.structure;
	};
	konsent.removeInterfaceStructure = function()
	{
		if (typeof konsent.structure != 'undefined')
		{
			if (konsent.config.animate)
			{
				return konsent._sizeAnimation(konsent.structure.container, {height:0}, 20, function(){
					konsent._destroyStructure();
				});
			}
			konsent._destroyStructure();
		}
	};
	konsent._destroyStructure = function()
	{
		konsent.structure.container.parentNode.removeChild(konsent.structure.container);
		delete konsent.structure;
	};
	konsent.createConsentInterface = function()
	{
		var structure = konsent.getInterfaceStructure(),
		            p;

		for (p in structure)
		{
			structure[p].className = 'konsent_' + p;
			if (typeof konsent.config.text[p] != 'undefined')
			{
				if (/button/i.test(structure[p].nodeName))
					structure[p].appendChild(document.createTextNode(konsent.config.text[p]));
				else
					structure[p].innerHTML = konsent.config.text[p];
			}
		}
		konsent._applyDefaultStyle();

		structure.consent.onclick = function(){
			konsent.userConsent(true);
			konsent.removeInterfaceStructure();
		};

		structure.decline.onclick = function(){
			konsent.userConsent(false);
			konsent.removeInterfaceStructure();
		};

		structure.more.onclick = function(){
			konsent.structure.more.style.display       = 'none';
			konsent.structure.explain.style.display    = 'block';
			konsent.structure.explain.style.visibility = 'hidden';
			konsent._sizeAnimation(konsent.structure.container, {height:konsent.structure.content.offsetHeight || konsent.structure.content.clientHeight || null}, 15, function(){
				konsent.structure.explain.style.visibility = ''
			});
		};
	};
	konsent._getStyleNode = function(parent)
	{
		var node = false,
			domain = document.location.href.match(/([a-z]+:\/\/[a-z_\.-]+)/),
			i;
		if (document.styleSheets)
		{
			for (i = 0; i < document.styleSheets.length; ++i)
				if (!document.styleSheets[i].href || (new RegExp(domain ? domain[0] : document.location.href)).test(document.styleSheets[i].href))
				{
					node = document.styleSheets[i];
					break;
				}
			if (!node)
			{
				parent.insertBefore(document.createElement('style'), parent.firstChild);
				node = document.styleSheets[0]; // use first styleSheet, because this is the one you just added
			}
		}
		return node;
	};
	konsent._applyDefaultStyle = function()
	{
		var node = konsent._getStyleNode((document.head || document.body)),
			c, css, p;

		if (node)
			for (c in konsent.config.style)
			{
				css = '';
				for (p in konsent.config.style[c])
					css += p.replace(/([A-Z])/g, '-$1').toLowerCase() + ':' + konsent.config.style[c][p] + ';';
				if (css != '')
				{
					if (node.insertRule)
						node.insertRule('.konsent_' + c + ' {' + css + '}', 0);
					else if (node.addRule)
						node.addRule('.konsent_' + c, css, 0);
				}
			}
	};

	//  external script loading
	konsent.loadScript = function(src, callback, cleanUp)
	{
		var script  = document.createElement('script'),
		  onReady   = callback || function(){};
		if (cleanUp)
			callback = function(){callback();script.parentNode.removeChild(script)};
		script.type = "text/javascript";
		if (script.onreadystatechange)
			script.onreadystatechange = function(){if(/complete|loaded/.test(this.readyState))onReady()};
		else if (typeof script.onload != 'undefined')
			script.onload = onReady;
		else
			konsent._scriptLoadPolling(onReady);
		script.src = src;
		(document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(script);
	};
	konsent._scriptLoadPolling = function(callback)
	{
		//  IE 7 and older don't support (all) onreadystatechange/onload events, we poll the callback function to see if it's loaded
		clearTimeout(konsent._scriptLoadPollingTimer);
		try{callback()}
		catch(e){konsent._scriptLoadPollingTimer = setTimeout(function(){konsent._scriptLoadPolling(callback)}, 50)}
	};

	//  configure
	konsent._configure = function()
	{
		var consent = konsent.getConsentCookie();

		if (typeof consent.allow == 'boolean')
		{
			return konsent._enterState(consent.allow ? konsent.state.HAS_CONSENT : konsent.state.NO_CONSENT);
		}
		else if ((konsent.config.countries || konsent.config.continents))
		{
			konsent.loadScript(
				konsent.config.geo.provider,
				konsent.config.geo.callback
			);
		}
		else //if (typeof consent.allow == 'boolean')
		{
			konsent._leaveState(konsent.state.CONFIG);
		}
	};

	//  state machine
	konsent._getStateListeners = function(state)
	{
		if (typeof konsent._stateListener == 'undefined')
			konsent._stateListener = [];
		if (typeof konsent._stateListener[state] == 'undefined')
			konsent._stateListener[state] = [];
		return konsent._stateListener[state];
	};
	konsent.addStateListener = function(state, callback)
	{
		var listener = konsent._getStateListeners(state);
		listener[listener.length] = callback;
	};
	konsent._leaveState = function(state)
	{
		switch (state)
		{
			case konsent.state.INIT:
			case konsent.state.CONFIG:
				konsent._enterState(state + 1);
				break;

			case konsent.state.READY:
			case konsent.state.OBTAINED_CONSENT:
			case konsent.state.REVOKED_CONSENT:
			case konsent.state.IMPLICIT_CONSENT:
			case konsent.state.HAS_CONSENT:
			case konsent.state.NO_CONSENT:
			case konsent.state.DO_NOT_TRACK:
			default:
				break;
		}
	};
	konsent._enterState = function(state)
	{
		konsent._currentState = state;
		switch (state)
		{
			case konsent.state.INIT:
			case konsent.state.CONFIG:
				break;

			case konsent.state.READY:
				var consent = konsent.getConsentCookie(),
				    require = false;

				switch(consent.allow)
				{
					case true: //  there is consent, the state is pushed towards HAS_CONSENT
						konsent._enterState(konsent.state.HAS_CONSENT);
						return;

					case false: //  there is NO consent, the state is pushed towards NO_CONSENT
						konsent._enterState(konsent.state.NO_CONSENT);
						return;

					default:
						// not all countries require the consent (even though it is good practise to ask everybody
						if (!require && konsent.config.countries)  require = (new RegExp('\\b' + konsent.geo.code + '\\b')).test(konsent.config.countries);
						if (!require && konsent.config.continents) require = (new RegExp('\\b' + konsent.geo.continent + '\\b')).test(konsent.config.continents);
						if (!require)
						{
							konsent._enterState(konsent.state.IMPLICIT_CONSENT);
							return;
						}
						break;
				}

				if (konsent.config.automaticallyAsk)
					konsent.askUserConsent();
				break;

			case konsent.state.OBTAINED_CONSENT:
			case konsent.state.REVOKED_CONSENT:
			case konsent.state.IMPLICIT_CONSENT:
			case konsent.state.HAS_CONSENT:
			case konsent.state.NO_CONSENT:
			case konsent.state.DO_NOT_TRACK:
			default:
				break;
		}


		konsent._currentState = state;
		konsent._triggerStateHandler(state);
	};
	konsent._triggerStateHandler = function(state)
	{
		var event = konsent._getStateName(state).replace(/[^A-Z]+/g, '').toLowerCase(),
		 listener = konsent._getStateListeners(state),
		        i;

		if (typeof listener != 'undefined')
			for (i = 0; i < listener.length; ++i)
				if (state == konsent._currentState)
					listener[i]();

		//  check for an assigned event and call it if it exists
		if (state == konsent._currentState)
		{
			if (konsent.config && konsent.config.useSimpleEventModel)
			{
				switch (state)
				{
					case konsent.state.INIT:
					case konsent.state.CONFIG:
					case konsent.state.READY:
						break;

					case konsent.state.IMPLICIT_CONSENT:
					case konsent.state.OBTAINED_CONSENT:
					case konsent.state.HAS_CONSENT:
						event = 'consent';
						break;

					case konsent.state.REVOKED_CONSENT:
					case konsent.state.NO_CONSENT:
					case konsent.state.DO_NOT_TRACK:
						event = 'noconsent';
						break;
				}
			}

			if (typeof konsent['on' + event] == 'function')
			{
				konsent['on' + event].call(konsent);
			}
		}
	};

	//  cookie access
	konsent.getCookie = function(name)
	{
		var cookie = document.cookie.split(';'),
		     match = null,
		         i;
		for (i = 0; i < cookie.length; ++i)
		{
			match = cookie[i].match(new RegExp(name + '=(.*)', 'i'));
			if (match && match.length > 1)
				return match[1];
		}
		return '';
	};
	konsent.setCookie = function(name, value, lifetime, path, domain)
	{
		var expire = '';
		if (lifetime)
		{
			expire = new Date();
			expire.setDate(expire.getDate() + lifetime);
			expire = expire.toUTCString();
		}
		document.cookie = name + '=' + value + '; expires=' + expire + (path ? '; path=' + path : '') + (domain ? '; domain=' + domain : '');
	};
	konsent.getConsentCookie = function()
	{
		var value = konsent.getCookie(konsent.config.cookie.name),
		    match = value.match(/^(yes|no):([0-9]{13,})$/),
		     date = new Date();

		return {
			value:value,
			allow:(match && match.length > 1 ? match[1] == konsent.config.cookie.valueAllowed : null),
			date:(match && match.length > 2 && date.setTime(match[2]) ? date : null)
		};
	};
	konsent.setConsentCookie = function(doAllow)
	{
		var prevValue = konsent.getConsentCookie(),
		   hasChanged = typeof prevValue.allow != 'boolean' || prevValue.allow != doAllow;

		konsent.setCookie(
			konsent.config.cookie.name,
			(doAllow ? konsent.config.cookie.valueAllowed : konsent.config.cookie.valueDeclined) + ':' + (new Date()).getTime(),
			konsent.config.cookie.lifetime,
			konsent.config.cookie.path,
			konsent.config.cookie.domain
		);

		if (hasChanged)
			konsent._enterState(doAllow ? konsent.state.OBTAINED_CONSENT : (prevValue.allow == true ? konsent.state.REVOKED_CONSENT : konsent.state.NO_CONSENT));
	};
	konsent.getConsentChoiceAge = function()
	{
		var now = (new Date()).getTime(),
		consent = konsent.getConsentCookie(),
		  delta = consent && consent.date ? now - consent.date.getTime() : false;

		return {
			ms:delta,
			seconds:delta ? Math.floor(delta /= 1000) : false,
			minutes:delta ? Math.floor(delta /= 60) : false,
			hours:delta ? Math.floor(delta /= 60) : false,
			days:delta ? Math.floor(delta /= 24) : false,
			weeks:delta ? Math.floor(delta /= 7) : false
		};
	};

	//  helpers
	konsent._doNotTrack = function()
	{
		var dnt = navigator.doNotTrack || navigator.msDoNotTrack || 'unspecified';
		if (/0|1/.test(dnt + '')) //  adjust the value to yes/no in case the preliminary spec was followed, thus setting the header values 0 (no) and 1 (yes)
			dnt = dnt == '1' ? 'yes' : 'no';
		return dnt == 'yes';
	};
	konsent._sizeAnimation = function(obj, style, steps, ready)
	{
		obj._animate = function(c)
		{
			var obj = this,
			      p;
			clearTimeout(c.timer);
			++c.step;
			for (p in c.to)
				obj.style[p] = c.smooth(c.from[p], c.to[p], c.step, c.steps) + 'px';
			if (c.step >= c.steps)
			{
				if (c.ready) c.ready();
				obj._animate = null;
				return;
			}
			c.timer = setTimeout(function(){obj._animate(c);}, 40);
		};
		obj._animate({
			to:style,
			from:{width:typeof style.width ? obj.offsetWidth || obj.clientHeight || null : null,height:typeof style.height ? obj.offsetHeight || obj.clientHeight || null : null},
			step:0,
			steps:steps,
			timer:null,
			smooth:function(from, to, step, steps){return (to - from) / 2 * ((step /= steps / 2) < 1 ? Math.pow(step, 3) : (step -= 2) * Math.pow(step, 2) + 2) + from;},
			ready:ready
		});
	};
	konsent._getStateName = function(state)
	{
		for (var p in konsent.state)
			if (konsent.state[p] == state)
				return p;
		return 'unknown';
	};
	konsent._mergeObjects = function(d, s)
	{
		for (var p in s)
			if (typeof d[p] != typeof s[p]) d[p] = s[p];
			else if (s[p] instanceof Object) d[p] = konsent._mergeObjects(d[p], s[p]);
		return d;
	};

	//  constants
	konsent.state = {INIT:0,CONFIG:1,READY:2,OBTAINED_CONSENT:3,REVOKED_CONSENT:4,IMPLICIT_CONSENT:5,HAS_CONSENT:6,NO_CONSENT:7,DO_NOT_TRACK:8};

	//  default configuration
	konsent.defaultConfig = {
		cookie:{
			name:'konsentConsent',
			lifetime:365,
			valueAllowed:'yes',
			valueDeclined:'no',
			domain:'.' + (window.location.host.split('.').splice(-2)).join('.'), //  the main domain
			path:'/'
		},
		automaticallyAsk:true,
		animate:true,
		respectDoNotTrack:true,
		countries:[
			'AT',  //  Austria
			'BE',  //  Belgium
			'BG',  //  Bulgaria
			'CY',  //  Cyprus
			'CZ',  //  Czech Republic
			'DK',  //  Denmark
			'EE',  //  Estonia
			'FI',  //  Finland
			'FR',  //  France
			'DE',  //  Germany
			'GR',  //  Greece
			'HU',  //  Hungary
			'IE',  //  Ireland
			'IT',  //  Italy
			'LV',  //  Latvia
			'LT',  //  Lithuania
			'LU',  //  Luxembourg
			'MT',  //  Malta
			'NL',  //  Netherlands
			'PL',  //  Poland
			'PT',  //  Portugal
			'RO',  //  Romania
			'SK',  //  Slovakia
			'SI',  //  Slovenia
			'ES',  //  Spain
			'SE',  //  Sweden
			'GB',  //  United Kingdom
		].join(','),
		continents:false,
		geo:{
			provider:'http://konfirm.net/api/geo/summary.jsonp?callback=Konsent.setGeoLocation'
		},
		style:{
			container:{position:'relative', fontFamily:'"Lucida Grande", "Trebuchet MS", Verdana, _sans', backgroundColor:'#111', color:'#fff'},
			  content:{fontSize:'18px', lineHeight:'24px'},
			    extra:{padding:'5px 0'},
			  explain:{display:'none', fontSize:'14px', lineHeight:'18px'}
		},
		text:{
			question:'Do you want to allow non-essential cookies?',
			    more:'Read more',
			 explain:'As of the 26th of May 2012, all EU citizens must provide explicit consent to allow websites to use so called tracking-cookies. These cookies usually derive from other websites which integrate functionality into the website you are visiting.',
			 consent:'Yes, I allow this',
			 decline:'No, thank you'
		},
		useSimpleEventModel:true
	};
})();

function konsent(config)
{
	document && document.body && document.head ? Konsent.init(config) : Konsent.delayInit(config);
};
