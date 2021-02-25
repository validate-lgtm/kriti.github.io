
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
var app = (function () {
	'use strict';

	function noop() {}

	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char }
		};
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	function run_all(fns) {
		fns.forEach(run);
	}

	function is_function(thing) {
		return typeof thing === 'function';
	}

	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
	}

	function append(target, node) {
		target.appendChild(node);
	}

	function insert(target, node, anchor) {
		target.insertBefore(node, anchor);
	}

	function detach(node) {
		node.parentNode.removeChild(node);
	}

	function element(name) {
		return document.createElement(name);
	}

	function text(data) {
		return document.createTextNode(data);
	}

	function space() {
		return text(' ');
	}

	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	function children(element) {
		return Array.from(element.childNodes);
	}

	function set_data(text, data) {
		data = '' + data;
		if (text.data !== data) text.data = data;
	}

	function set_style(node, key, value) {
		node.style.setProperty(key, value);
	}

	let current_component;

	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error(`Function called outside component initialization`);
		return current_component;
	}

	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	const dirty_components = [];

	let update_promise;
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];

	function schedule_update() {
		if (!update_promise) {
			update_promise = Promise.resolve();
			update_promise.then(flush);
		}
	}

	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	function flush() {
		const seen_callbacks = new Set();

		do {
			// first, call beforeUpdate functions
			// and update components
			while (dirty_components.length) {
				const component = dirty_components.shift();
				set_current_component(component);
				update(component.$$);
			}

			while (binding_callbacks.length) binding_callbacks.shift()();

			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			while (render_callbacks.length) {
				const callback = render_callbacks.pop();
				if (!seen_callbacks.has(callback)) {
					callback();

					// ...so guard against infinite loops
					seen_callbacks.add(callback);
				}
			}
		} while (dirty_components.length);

		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}

		update_promise = null;
	}

	function update($$) {
		if ($$.fragment) {
			$$.update($$.dirty);
			run_all($$.before_render);
			$$.fragment.p($$.dirty, $$.ctx);
			$$.dirty = null;

			$$.after_render.forEach(add_render_callback);
		}
	}

	function mount_component(component, target, anchor) {
		const { fragment, on_mount, on_destroy, after_render } = component.$$;

		fragment.m(target, anchor);

		// onMount happens after the initial afterUpdate. Because
		// afterUpdate callbacks happen in reverse order (inner first)
		// we schedule onMount callbacks before afterUpdate callbacks
		add_render_callback(() => {
			const new_on_destroy = on_mount.map(run).filter(is_function);
			if (on_destroy) {
				on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});

		after_render.forEach(add_render_callback);
	}

	function destroy(component, detaching) {
		if (component.$$) {
			run_all(component.$$.on_destroy);
			component.$$.fragment.d(detaching);

			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			component.$$.on_destroy = component.$$.fragment = null;
			component.$$.ctx = {};
		}
	}

	function make_dirty(component, key) {
		if (!component.$$.dirty) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty = {};
		}
		component.$$.dirty[key] = true;
	}

	function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
		const parent_component = current_component;
		set_current_component(component);

		const props = options.props || {};

		const $$ = component.$$ = {
			fragment: null,
			ctx: null,

			// state
			props: prop_names,
			update: noop,
			not_equal: not_equal$$1,
			bound: blank_object(),

			// lifecycle
			on_mount: [],
			on_destroy: [],
			before_render: [],
			after_render: [],
			context: new Map(parent_component ? parent_component.$$.context : []),

			// everything else
			callbacks: blank_object(),
			dirty: null
		};

		let ready = false;

		$$.ctx = instance
			? instance(component, props, (key, value) => {
				if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
					if ($$.bound[key]) $$.bound[key](value);
					if (ready) make_dirty(component, key);
				}
			})
			: props;

		$$.update();
		ready = true;
		run_all($$.before_render);
		$$.fragment = create_fragment($$.ctx);

		if (options.target) {
			if (options.hydrate) {
				$$.fragment.l(children(options.target));
			} else {
				$$.fragment.c();
			}

			if (options.intro && component.$$.fragment.i) component.$$.fragment.i();
			mount_component(component, options.target, options.anchor);
			flush();
		}

		set_current_component(parent_component);
	}

	class SvelteComponent {
		$destroy() {
			destroy(this, true);
			this.$destroy = noop;
		}

		$on(type, callback) {
			const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
			callbacks.push(callback);

			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		$set() {
			// overridden by instance, if it has props
		}
	}

	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error(`'target' is a required option`);
			}

			super();
		}

		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn(`Component was already destroyed`); // eslint-disable-line no-console
			};
		}
	}

	/* src/sections/Header.svelte generated by Svelte v3.0.0 */

	const file = "src/sections/Header.svelte";

	function create_fragment(ctx) {
		var div2, div1, div0, button0, t1, button1, t3, a, div2_class_value, dispose;

		return {
			c: function create() {
				div2 = element("div");
				div1 = element("div");
				div0 = element("div");
				button0 = element("button");
				button0.textContent = "Intro";
				t1 = space();
				button1 = element("button");
				button1.textContent = "Certificates";
				t3 = space();
				a = element("a");
				a.textContent = "Resume";
				button0.className = "links svelte-1dfbl6";
				button0.dataset.id = "intro";
				add_location(button0, file, 79, 6, 1726);
				button1.className = "links svelte-1dfbl6";
				button1.dataset.id = "certificates";
				add_location(button1, file, 80, 6, 1785);
				a.target = "_blank";
				a.href = "./src/images/resume.pdf";
				a.className = "links svelte-1dfbl6";
				add_location(a, file, 81, 6, 1858);
				div0.className = "buttons-container svelte-1dfbl6";
				add_location(div0, file, 78, 4, 1660);
				div1.className = "header svelte-1dfbl6";
				add_location(div1, file, 77, 2, 1635);
				div2.className = div2_class_value = "header-container container-fluid " + (ctx.isMobile ? 'mobile' : '') + " svelte-1dfbl6";
				add_location(div2, file, 76, 0, 1559);
				dispose = listen(div0, "click", ctx.handleNavigation);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div1);
				append(div1, div0);
				append(div0, button0);
				append(div0, t1);
				append(div0, button1);
				append(div0, t3);
				append(div0, a);
			},

			p: function update(changed, ctx) {
				if ((changed.isMobile) && div2_class_value !== (div2_class_value = "header-container container-fluid " + (ctx.isMobile ? 'mobile' : '') + " svelte-1dfbl6")) {
					div2.className = div2_class_value;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div2);
				}

				dispose();
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		

	  let { isMobile } = $$props;

	  const handleNavigation = event => {
	    const target = event.target;
	    const id = target.dataset.id;
	    const element = document.getElementById(id);
	    console.log({ element });
	    if (element) {
	      element.scrollIntoView({
	        behavior: "smooth"
	      });
	    }
	  };

		$$self.$set = $$props => {
			if ('isMobile' in $$props) $$invalidate('isMobile', isMobile = $$props.isMobile);
		};

		return { isMobile, handleNavigation };
	}

	class Header extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, ["isMobile"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.isMobile === undefined && !('isMobile' in props)) {
				console.warn("<Header> was created without expected prop 'isMobile'");
			}
		}

		get isMobile() {
			throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set isMobile(value) {
			throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/components/Image.svelte generated by Svelte v3.0.0 */

	const file$1 = "src/components/Image.svelte";

	function create_fragment$1(ctx) {
		var div, img;

		return {
			c: function create() {
				div = element("div");
				img = element("img");
				img.src = ctx.src;
				img.alt = "";
				img.className = "svelte-1nhw3cv";
				add_location(img, file$1, 17, 2, 311);
				set_style(div, "height", "" + ctx.height + "px");
				set_style(div, "width", "" + ctx.width + "px");
				div.className = "image-container svelte-1nhw3cv";
				add_location(div, file$1, 16, 0, 235);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, img);
			},

			p: function update(changed, ctx) {
				if (changed.src) {
					img.src = ctx.src;
				}

				if (changed.height) {
					set_style(div, "height", "" + ctx.height + "px");
				}

				if (changed.width) {
					set_style(div, "width", "" + ctx.width + "px");
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { src = "https://via.placeholder.com/150/150", height = 150, width = 150 } = $$props;

		$$self.$set = $$props => {
			if ('src' in $$props) $$invalidate('src', src = $$props.src);
			if ('height' in $$props) $$invalidate('height', height = $$props.height);
			if ('width' in $$props) $$invalidate('width', width = $$props.width);
		};

		return { src, height, width };
	}

	class Image extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$1, create_fragment$1, safe_not_equal, ["src", "height", "width"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.src === undefined && !('src' in props)) {
				console.warn("<Image> was created without expected prop 'src'");
			}
			if (ctx.height === undefined && !('height' in props)) {
				console.warn("<Image> was created without expected prop 'height'");
			}
			if (ctx.width === undefined && !('width' in props)) {
				console.warn("<Image> was created without expected prop 'width'");
			}
		}

		get src() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set src(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get height() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set height(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get width() {
			throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set width(value) {
			throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/components/SectionHeading.svelte generated by Svelte v3.0.0 */

	const file$2 = "src/components/SectionHeading.svelte";

	// (18:2) {#if subHeading}
	function create_if_block(ctx) {
		var div;

		return {
			c: function create() {
				div = element("div");
				div.className = "center text-grey container-subheading thin xxl-h-padding";
				add_location(div, file$2, 18, 4, 306);
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				div.innerHTML = ctx.subHeading;
			},

			p: function update(changed, ctx) {
				if (changed.subHeading) {
					div.innerHTML = ctx.subHeading;
				}
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	function create_fragment$2(ctx) {
		var div1, div0, t0, div0_class_value, t1;

		var if_block = (ctx.subHeading) && create_if_block(ctx);

		return {
			c: function create() {
				div1 = element("div");
				div0 = element("div");
				t0 = text(ctx.heading);
				t1 = space();
				if (if_block) if_block.c();
				div0.className = div0_class_value = "container-heading sub-heading bold " + (!ctx.center ? 'left' : '') + " svelte-1vhgi6v";
				add_location(div0, file$2, 14, 2, 187);
				div1.className = "" + ctx.containerClass + " svelte-1vhgi6v";
				add_location(div1, file$2, 13, 0, 156);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div1, anchor);
				append(div1, div0);
				append(div0, t0);
				append(div1, t1);
				if (if_block) if_block.m(div1, null);
			},

			p: function update(changed, ctx) {
				if (changed.heading) {
					set_data(t0, ctx.heading);
				}

				if ((changed.center) && div0_class_value !== (div0_class_value = "container-heading sub-heading bold " + (!ctx.center ? 'left' : '') + " svelte-1vhgi6v")) {
					div0.className = div0_class_value;
				}

				if (ctx.subHeading) {
					if (if_block) {
						if_block.p(changed, ctx);
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						if_block.m(div1, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (changed.containerClass) {
					div1.className = "" + ctx.containerClass + " svelte-1vhgi6v";
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div1);
				}

				if (if_block) if_block.d();
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let { heading, subHeading, center = true, containerClass = "" } = $$props;

		$$self.$set = $$props => {
			if ('heading' in $$props) $$invalidate('heading', heading = $$props.heading);
			if ('subHeading' in $$props) $$invalidate('subHeading', subHeading = $$props.subHeading);
			if ('center' in $$props) $$invalidate('center', center = $$props.center);
			if ('containerClass' in $$props) $$invalidate('containerClass', containerClass = $$props.containerClass);
		};

		return {
			heading,
			subHeading,
			center,
			containerClass
		};
	}

	class SectionHeading extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$2, create_fragment$2, safe_not_equal, ["heading", "subHeading", "center", "containerClass"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.heading === undefined && !('heading' in props)) {
				console.warn("<SectionHeading> was created without expected prop 'heading'");
			}
			if (ctx.subHeading === undefined && !('subHeading' in props)) {
				console.warn("<SectionHeading> was created without expected prop 'subHeading'");
			}
			if (ctx.center === undefined && !('center' in props)) {
				console.warn("<SectionHeading> was created without expected prop 'center'");
			}
			if (ctx.containerClass === undefined && !('containerClass' in props)) {
				console.warn("<SectionHeading> was created without expected prop 'containerClass'");
			}
		}

		get heading() {
			throw new Error("<SectionHeading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set heading(value) {
			throw new Error("<SectionHeading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get subHeading() {
			throw new Error("<SectionHeading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set subHeading(value) {
			throw new Error("<SectionHeading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get center() {
			throw new Error("<SectionHeading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set center(value) {
			throw new Error("<SectionHeading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get containerClass() {
			throw new Error("<SectionHeading>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set containerClass(value) {
			throw new Error("<SectionHeading>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/sections/About.svelte generated by Svelte v3.0.0 */

	const file$3 = "src/sections/About.svelte";

	function create_fragment$3(ctx) {
		var div, h30, t1, p0, t3, h31, t5, p1, t7, p2;

		return {
			c: function create() {
				div = element("div");
				h30 = element("h3");
				h30.textContent = "My professional Mission";
				t1 = space();
				p0 = element("p");
				p0.textContent = "My mission as an educator is to promote inclusion of different kinds of\n    learner, encourage them and work on them for their holistic development by\n    inculcating in them the passion for learning and creating quality\n    relationships, so that they grow up to be independent and critical thinkers.";
				t3 = space();
				h31 = element("h3");
				h31.textContent = "My Beliefs";
				t5 = space();
				p1 = element("p");
				p1.textContent = "I believe that students are capable of doing everything they want and all\n    they need is a little push in the right direction. I believe that I, as a\n    teacher, am teaching individuals instead of a class, who contribute to the\n    teaching environment.";
				t7 = space();
				p2 = element("p");
				p2.textContent = "I believe that teachers have an obligation to design environments that\n    maximize the potential for the students to have meaningful and\n    transformative learning experiences Teachers must educate their students and\n    teach them the skills needed in the practical world. I believe that not only\n    teachers, but families and communities all work and support each other in\n    enriching the life of a child.";
				h30.className = "sub-heading";
				add_location(h30, file$3, 1, 2, 32);
				add_location(p0, file$3, 2, 2, 87);
				h31.className = "sub-heading";
				add_location(h31, file$3, 8, 2, 406);
				add_location(p1, file$3, 9, 2, 448);
				add_location(p2, file$3, 15, 2, 722);
				div.className = "about-container";
				add_location(div, file$3, 0, 0, 0);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				append(div, h30);
				append(div, t1);
				append(div, p0);
				append(div, t3);
				append(div, h31);
				append(div, t5);
				append(div, p1);
				append(div, t7);
				append(div, p2);
			},

			p: noop,
			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	class About extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$3, safe_not_equal, []);
		}
	}

	/* src/sections/Intro.svelte generated by Svelte v3.0.0 */

	const file$4 = "src/sections/Intro.svelte";

	function create_fragment$4(ctx) {
		var div2, div0, t0, h3, t2, div1, t3, p0, t5, p1, t7, p2, t9, p3, t11, p4, t13, p5, t15, div2_class_value, current;

		var image = new Image({
			props: { src: 'src/images/intro.png' },
			$$inline: true
		});

		var sectionheading = new SectionHeading({
			props: {
			heading: 'About me',
			center: false
		},
			$$inline: true
		});

		var about = new About({ $$inline: true });

		return {
			c: function create() {
				div2 = element("div");
				div0 = element("div");
				image.$$.fragment.c();
				t0 = space();
				h3 = element("h3");
				h3.textContent = "Kriti";
				t2 = space();
				div1 = element("div");
				sectionheading.$$.fragment.c();
				t3 = space();
				p0 = element("p");
				p0.textContent = "I am a post graduate in Economics and currently pursuing B.Ed from\n      Chitkara College of Education, Chitkara University.";
				t5 = space();
				p1 = element("p");
				p1.textContent = "I am a highly organised and a patient person who believes in finding\n      solutions to problems in hand.";
				t7 = space();
				p2 = element("p");
				p2.textContent = "I am currently working part time with an NGO, Anugrah Siksha Kendra- A\n      center for Dyslexic Students which has increased my love for teaching even\n      more.";
				t9 = space();
				p3 = element("p");
				p3.textContent = "I am a creative person who is always up for new activities. I love\n      exploring new things and places.";
				t11 = space();
				p4 = element("p");
				p4.textContent = "I am very dedicated and self motivated in addition to this In addition to\n      this I strive to perfect every task I take up.";
				t13 = space();
				p5 = element("p");
				p5.textContent = "I have imbibed my disciplined behavior from my mother's lifestyle and it\n      is now a part of who I am.";
				t15 = space();
				about.$$.fragment.c();
				h3.className = "name sub-heading svelte-1piwtpd";
				add_location(h3, file$4, 28, 4, 607);
				div0.className = "intro-image svelte-1piwtpd";
				add_location(div0, file$4, 26, 2, 534);
				add_location(p0, file$4, 32, 4, 746);
				add_location(p1, file$4, 36, 4, 894);
				add_location(p2, file$4, 40, 4, 1023);
				add_location(p3, file$4, 45, 4, 1210);
				add_location(p4, file$4, 49, 4, 1339);
				add_location(p5, file$4, 53, 4, 1489);
				div1.className = "intro-text";
				add_location(div1, file$4, 30, 2, 658);
				div2.className = div2_class_value = "intro-container container-fluid " + (ctx.isMobile ? 'mobile' : '') + " svelte-1piwtpd";
				div2.id = "intro";
				add_location(div2, file$4, 25, 0, 448);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div0);
				mount_component(image, div0, null);
				append(div0, t0);
				append(div0, h3);
				append(div2, t2);
				append(div2, div1);
				mount_component(sectionheading, div1, null);
				append(div1, t3);
				append(div1, p0);
				append(div1, t5);
				append(div1, p1);
				append(div1, t7);
				append(div1, p2);
				append(div1, t9);
				append(div1, p3);
				append(div1, t11);
				append(div1, p4);
				append(div1, t13);
				append(div1, p5);
				append(div1, t15);
				mount_component(about, div1, null);
				current = true;
			},

			p: function update(changed, ctx) {
				if ((!current || changed.isMobile) && div2_class_value !== (div2_class_value = "intro-container container-fluid " + (ctx.isMobile ? 'mobile' : '') + " svelte-1piwtpd")) {
					div2.className = div2_class_value;
				}
			},

			i: function intro(local) {
				if (current) return;
				image.$$.fragment.i(local);

				sectionheading.$$.fragment.i(local);

				about.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				image.$$.fragment.o(local);
				sectionheading.$$.fragment.o(local);
				about.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div2);
				}

				image.$destroy();

				sectionheading.$destroy();

				about.$destroy();
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		

	  let { isMobile } = $$props;

		$$self.$set = $$props => {
			if ('isMobile' in $$props) $$invalidate('isMobile', isMobile = $$props.isMobile);
		};

		return { isMobile };
	}

	class Intro extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$3, create_fragment$4, safe_not_equal, ["isMobile"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.isMobile === undefined && !('isMobile' in props)) {
				console.warn("<Intro> was created without expected prop 'isMobile'");
			}
		}

		get isMobile() {
			throw new Error("<Intro>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set isMobile(value) {
			throw new Error("<Intro>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/components/Slider.svelte generated by Svelte v3.0.0 */

	const file$5 = "src/components/Slider.svelte";

	function create_fragment$5(ctx) {
		var div4, div3, div1, div0, img0, t0, img1, t1, img2, t2, img3, t3, div2, li0, li0_class_value, t4, li1, li1_class_value, t5, li2, li2_class_value, t6, li3, li3_class_value;

		return {
			c: function create() {
				div4 = element("div");
				div3 = element("div");
				div1 = element("div");
				div0 = element("div");
				img0 = element("img");
				t0 = space();
				img1 = element("img");
				t1 = space();
				img2 = element("img");
				t2 = space();
				img3 = element("img");
				t3 = space();
				div2 = element("div");
				li0 = element("li");
				t4 = space();
				li1 = element("li");
				t5 = space();
				li2 = element("li");
				t6 = space();
				li3 = element("li");
				img0.src = "./src/images/KRITI.jpg";
				img0.alt = "cert1";
				add_location(img0, file$5, 40, 8, 841);
				img1.src = "./src/images/kriti2.png";
				img1.alt = "cert2";
				add_location(img1, file$5, 41, 8, 898);
				img2.src = "./src/images/kriti3.png";
				img2.alt = "cert3";
				add_location(img2, file$5, 42, 8, 956);
				img3.src = "./src/images/kriti4.png";
				img3.alt = "cert4";
				add_location(img3, file$5, 43, 8, 1014);
				div0.className = "glide__slides list svelte-18p3fzs";
				add_location(div0, file$5, 39, 6, 800);
				div1.className = "glide__track";
				div1.dataset.glideEl = "track";
				add_location(div1, file$5, 38, 4, 745);
				li0.className = li0_class_value = "glide__bullet " + (0 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs";
				li0.dataset.glideDir = 0;
				add_location(li0, file$5, 47, 6, 1127);
				li1.className = li1_class_value = "glide__bullet " + (1 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs";
				li1.dataset.glideDir = 1;
				add_location(li1, file$5, 50, 6, 1246);
				li2.className = li2_class_value = "glide__bullet " + (2 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs";
				li2.dataset.glideDir = 2;
				add_location(li2, file$5, 53, 6, 1365);
				li3.className = li3_class_value = "glide__bullet " + (3 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs";
				li3.dataset.glideDir = 3;
				add_location(li3, file$5, 56, 6, 1484);
				div2.className = "glide__bullets";
				add_location(div2, file$5, 46, 4, 1092);
				div3.className = "glide";
				add_location(div3, file$5, 37, 2, 721);
				div4.className = "slider-container";
				add_location(div4, file$5, 36, 0, 688);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div4, anchor);
				append(div4, div3);
				append(div3, div1);
				append(div1, div0);
				append(div0, img0);
				append(div0, t0);
				append(div0, img1);
				append(div0, t1);
				append(div0, img2);
				append(div0, t2);
				append(div0, img3);
				append(div3, t3);
				append(div3, div2);
				append(div2, li0);
				append(div2, t4);
				append(div2, li1);
				append(div2, t5);
				append(div2, li2);
				append(div2, t6);
				append(div2, li3);
			},

			p: function update(changed, ctx) {
				if ((changed.currentId) && li0_class_value !== (li0_class_value = "glide__bullet " + (0 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs")) {
					li0.className = li0_class_value;
				}

				if ((changed.currentId) && li1_class_value !== (li1_class_value = "glide__bullet " + (1 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs")) {
					li1.className = li1_class_value;
				}

				if ((changed.currentId) && li2_class_value !== (li2_class_value = "glide__bullet " + (2 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs")) {
					li2.className = li2_class_value;
				}

				if ((changed.currentId) && li3_class_value !== (li3_class_value = "glide__bullet " + (3 === ctx.currentId ? 'glide__bullet--active' : '') + " svelte-18p3fzs")) {
					li3.className = li3_class_value;
				}
			},

			i: noop,
			o: noop,

			d: function destroy(detaching) {
				if (detaching) {
					detach(div4);
				}
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		
	  let { list = [], Component, autoplay = 0, currentId = 0 } = $$props;

	  onMount(() => {
	    let glide = new Glide(".glide");
	    glide.on("run.after", e => {
	      if (glide.index >= 0) {
	        $$invalidate('currentId', currentId = glide.index);
	      }
	    });
	    glide.mount().update({
	      type: "slider",
	      perView: 1,
	      startAt: 0,
	      autoplay
	    });
	  });

		$$self.$set = $$props => {
			if ('list' in $$props) $$invalidate('list', list = $$props.list);
			if ('Component' in $$props) $$invalidate('Component', Component = $$props.Component);
			if ('autoplay' in $$props) $$invalidate('autoplay', autoplay = $$props.autoplay);
			if ('currentId' in $$props) $$invalidate('currentId', currentId = $$props.currentId);
		};

		return { list, Component, autoplay, currentId };
	}

	class Slider extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$4, create_fragment$5, safe_not_equal, ["list", "Component", "autoplay", "currentId"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.list === undefined && !('list' in props)) {
				console.warn("<Slider> was created without expected prop 'list'");
			}
			if (ctx.Component === undefined && !('Component' in props)) {
				console.warn("<Slider> was created without expected prop 'Component'");
			}
			if (ctx.autoplay === undefined && !('autoplay' in props)) {
				console.warn("<Slider> was created without expected prop 'autoplay'");
			}
			if (ctx.currentId === undefined && !('currentId' in props)) {
				console.warn("<Slider> was created without expected prop 'currentId'");
			}
		}

		get list() {
			throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set list(value) {
			throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get Component() {
			throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set Component(value) {
			throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get autoplay() {
			throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set autoplay(value) {
			throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		get currentId() {
			throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set currentId(value) {
			throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	/* src/sections/Certificates.svelte generated by Svelte v3.0.0 */

	const file$6 = "src/sections/Certificates.svelte";

	function create_fragment$6(ctx) {
		var div, t, current;

		var sectionheading = new SectionHeading({
			props: { heading: 'Certificates' },
			$$inline: true
		});

		var slider = new Slider({ $$inline: true });

		return {
			c: function create() {
				div = element("div");
				sectionheading.$$.fragment.c();
				t = space();
				slider.$$.fragment.c();
				div.className = "container-fluid";
				div.id = "certificates";
				add_location(div, file$6, 10, 0, 164);
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				insert(target, div, anchor);
				mount_component(sectionheading, div, null);
				append(div, t);
				mount_component(slider, div, null);
				current = true;
			},

			p: noop,

			i: function intro(local) {
				if (current) return;
				sectionheading.$$.fragment.i(local);

				slider.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				sectionheading.$$.fragment.o(local);
				slider.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				if (detaching) {
					detach(div);
				}

				sectionheading.$destroy();

				slider.$destroy();
			}
		};
	}

	class Certificates extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, null, create_fragment$6, safe_not_equal, []);
		}
	}

	/* src/App.svelte generated by Svelte v3.0.0 */

	function create_fragment$7(ctx) {
		var t0, t1, current;

		var header = new Header({
			props: { isMobile: ctx.isMobile },
			$$inline: true
		});

		var intro = new Intro({
			props: { isMobile: ctx.isMobile },
			$$inline: true
		});

		var certificates = new Certificates({ $$inline: true });

		return {
			c: function create() {
				header.$$.fragment.c();
				t0 = space();
				intro.$$.fragment.c();
				t1 = space();
				certificates.$$.fragment.c();
			},

			l: function claim(nodes) {
				throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
			},

			m: function mount(target, anchor) {
				mount_component(header, target, anchor);
				insert(target, t0, anchor);
				mount_component(intro, target, anchor);
				insert(target, t1, anchor);
				mount_component(certificates, target, anchor);
				current = true;
			},

			p: function update(changed, ctx) {
				var header_changes = {};
				if (changed.isMobile) header_changes.isMobile = ctx.isMobile;
				header.$set(header_changes);

				var intro_changes = {};
				if (changed.isMobile) intro_changes.isMobile = ctx.isMobile;
				intro.$set(intro_changes);
			},

			i: function intro_1(local) {
				if (current) return;
				header.$$.fragment.i(local);

				intro.$$.fragment.i(local);

				certificates.$$.fragment.i(local);

				current = true;
			},

			o: function outro(local) {
				header.$$.fragment.o(local);
				intro.$$.fragment.o(local);
				certificates.$$.fragment.o(local);
				current = false;
			},

			d: function destroy(detaching) {
				header.$destroy(detaching);

				if (detaching) {
					detach(t0);
				}

				intro.$destroy(detaching);

				if (detaching) {
					detach(t1);
				}

				certificates.$destroy(detaching);
			}
		};
	}

	function instance$5($$self, $$props, $$invalidate) {
		let { isMobile } = $$props;

		$$self.$set = $$props => {
			if ('isMobile' in $$props) $$invalidate('isMobile', isMobile = $$props.isMobile);
		};

		return { isMobile };
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance$5, create_fragment$7, safe_not_equal, ["isMobile"]);

			const { ctx } = this.$$;
			const props = options.props || {};
			if (ctx.isMobile === undefined && !('isMobile' in props)) {
				console.warn("<App> was created without expected prop 'isMobile'");
			}
		}

		get isMobile() {
			throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}

		set isMobile(value) {
			throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
		}
	}

	const app = new App({
	    target: document.body,
	    props: {
	        isMobile: document.body.clientWidth < 768,
	    },
	});

	return app;

}());
