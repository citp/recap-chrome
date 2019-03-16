/*global jasmine */

describe('The ContentDelegate class', function() {
  const docketQueryUrl = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
  const docketQueryPath = '/cgi-bin/DktRpt.pl?531591';
  const docketDisplayUrl = ('https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?' +
    '101092135737069-L_1_0-1');
  const docketDisplayPath = '/cgi-bin/DktRpt.pl?101092135737069-L_1_0-1';
  const singleDocUrl = 'https://ecf.canb.uscourts.gov/doc1/034031424909';
  const singleDocPath = '/doc1/034031424909';
  const nonsenseUrl = 'http://something.uscourts.gov/foobar/baz';
  // Smallest possible PDF according to:
  // http://stackoverflow.com/questions/17279712/what-is-the-smallest-possible-valid-pdf
  const pdf_data = ('%PDF-1.\ntrailer<</Root<</Pages<</Kids' +
    '[<</MediaBox[0 0 3 3]>>]>>>>>>\n');

  const nonsenseUrlContentDelegate = new ContentDelegate(nonsenseUrl);
  const docketQueryContentDelegate = new ContentDelegate(
    docketQueryUrl, docketQueryPath, 'canb', '531591', []);
  const docketDisplayContentDelegate = new ContentDelegate(
    docketDisplayUrl, docketDisplayPath, 'canb', '531591', []);
  const singleDocContentDelegate =
    new ContentDelegate(singleDocUrl, singleDocPath, 'canb', '531591', []);

  function setupChromeSpy() {
    window.chrome = {
      extension : {getURL : jasmine.createSpy()},
      storage : {
        local : {
          get : jasmine.createSpy().and.callFake(function(
              _, cb) { cb({options : {}}); })
        }
      }
    }
  }

  function removeChromeSpy() {
    delete window.chrome;
  }

  beforeEach(function() {
    jasmine.Ajax.install();
    setupChromeSpy();
  });

  afterEach(function() {
    jasmine.Ajax.uninstall();
    removeChromeSpy();
  });

  describe('ContentDelegate constructor', function() {
    const expected_url = 'https://ecf.canb.uscourts.gov/cgi-bin/DktRpt.pl?531591';
    const expected_path = '/cgi-bin/DktRpt.pl?531591';
    const expected_court = 'canb';
    const expected_pacer_case_id = '531591';
    const expected_pacer_doc_id = '127015406472';
    const link_0 = document.createElement('a');
    link_0.href = 'http://foo/bar/0';
    const link_1 = document.createElement('a');
    link_1.href = 'http://foo/bar/1';
    const expected_links = [link_0, link_1];

    it('gets created with necessary arguments', function () {
      const cd = new ContentDelegate(expected_url, expected_path, expected_court,
        expected_pacer_case_id, expected_pacer_doc_id,
        expected_links);
      expect(cd.url).toBe(expected_url);
      expect(cd.path).toBe(expected_path);
      expect(cd.court).toBe(expected_court);
      expect(cd.pacer_case_id).toBe(expected_pacer_case_id);
      expect(cd.pacer_doc_id).toBe(expected_pacer_doc_id);
      expect(cd.links).toEqual(expected_links);
      expect(cd.restricted).toBe(false);
    });

    it('should flag restriction for Warning!', function () {
      const form = document.createElement('form');
      const input = document.createElement('input');
      form.appendChild(input);
      document.body.appendChild(form);

      const table = document.createElement('table');
      const table_tr = document.createElement('tr');
      const table_td = document.createElement('td');
      table.appendChild(table_tr);
      table_tr.appendChild(table_td);
      document.body.appendChild(table);
      table_td.textContent = "Warning!";

      expect(document.body.innerText).not.toContain('will not be uploaded');
      const cd = new ContentDelegate(expected_url, expected_path, expected_court,
        expected_pacer_case_id, expected_pacer_doc_id, expected_links);
      expect(cd.restricted).toBe(true);
      expect(document.body.innerText).toContain('will not be uploaded');
      table.remove();
      form.remove();
    });

    it('should flag restriction for bold restriction', function () {
      const form = document.createElement('form');
      const input = document.createElement('input');
      form.appendChild(input);
      document.body.appendChild(form);

      const paragraph = document.createElement('p');
      const bold = document.createElement('b');
      paragraph.appendChild(bold);
      document.body.appendChild(paragraph);
      bold.textContent = "SEALED";

      expect(document.body.innerText).not.toContain('will not be uploaded');
      const cd = new ContentDelegate(expected_url, expected_path, expected_court,
        expected_pacer_case_id, expected_pacer_doc_id, expected_links);
      expect(cd.restricted).toBe(true);
      expect(document.body.innerText).toContain('will not be uploaded');
      paragraph.remove();
      form.remove();
    });
  });

  describe('handleDocketQueryUrl', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.remove();
    });

    it('has no effect when not on a docket query url', function() {
      const cd = nonsenseUrlContentDelegate;
      spyOn(cd.recap, 'getAvailabilityForDocket');
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      expect(cd.recap.getAvailabilityForDocket).not.toHaveBeenCalled();
    });

    it('inserts the RECAP banner on an appropriate page', function() {
      const cd = docketQueryContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'application/json',
        'responseText' :
            ('{"count": 1, "results": [' +
             '{"date_modified": "04\/16\/15", "absolute_url": ' +
             '"/download\/gov.uscourts.' +
             'canb.531591\/gov.uscourts.canb.531591.docket.html"}]}')
      });
      const banner = document.querySelector('.recap-banner');
      expect(banner).not.toBeNull();
      expect(banner.innerHTML).toContain('04/16/15');
      const link = banner.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.href).toBe(
          'https://www.courtlistener.com/download/gov.uscourts.' +
          'canb.531591/gov.uscourts.canb.531591.docket.html')
    });

    it('has no effect when on a docket query that has no RECAP', function() {
      const cd = docketQueryContentDelegate;
      spyOn(PACER, 'hasPacerCookie').and.returnValue(true);
      cd.handleDocketQueryUrl();
      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'application/json',
        'responseText' : '{}'
      });
      const banner = document.querySelector('.recap-banner');
      expect(banner).toBeNull();
    });
  });

  describe('handleDocketDisplayPage', function() {
    beforeEach(function() {
      window.chrome = {
        storage : {
          local : {
            get : jasmine.createSpy().and.callFake(function(
                _, cb) { cb({options : {}}); })
          }
        }
      };
    });

    afterEach(function() {
      delete window.chrome;
    });

    it('has no effect when not on a docket display url', function() {
      const cd = nonsenseUrlContentDelegate;
      spyOn(cd.recap, 'uploadDocket');
      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
    });

    it('has no effect when there is no casenum', function() {
      const cd = new ContentDelegate(docketDisplayUrl);
      spyOn(cd.recap, 'uploadDocket');
      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
    });

    describe('when the history state is already set', function() {
      beforeEach(function() {
        history.replaceState({uploaded : true}, '');
      });

      afterEach(function() {
        history.replaceState({}, '');
      });

      it('has no effect', function() {
        const cd = docketDisplayContentDelegate;
        spyOn(cd.recap, 'uploadDocket');
        cd.handleDocketDisplayPage();
        expect(cd.recap.uploadDocket).not.toHaveBeenCalled();
      });
    });

    it('calls uploadDocket and responds to a positive result', function() {
      const cd = docketDisplayContentDelegate;
      spyOn(cd.notifier, 'showUpload');
      spyOn(cd.recap, 'uploadDocket')
          .and.callFake(function(_, _, _, _, cb) { cb(true); });
      spyOn(history, 'replaceState');

      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).toHaveBeenCalled();
      expect(cd.notifier.showUpload).toHaveBeenCalled();
      expect(history.replaceState).toHaveBeenCalledWith({uploaded : true}, '');
    });

    it('calls uploadDocket and responds to a negative result', function() {
      const cd = docketDisplayContentDelegate;
      spyOn(cd.notifier, 'showUpload');
      spyOn(cd.recap, 'uploadDocket')
          .and.callFake(function(_, _, _, _, cb) { cb(false); });
      spyOn(history, 'replaceState');

      cd.handleDocketDisplayPage();
      expect(cd.recap.uploadDocket).toHaveBeenCalled();
      expect(cd.notifier.showUpload).not.toHaveBeenCalled();
      expect(history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('handleAttachmentMenuPage', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
      window.chrome = {
        storage : {
          local : {
            get : jasmine.createSpy().and.callFake(function(
                _, cb) { cb({options : {}}); })
          }
        }
      };
    });

    afterEach(function() {
      form.remove();
      delete window.chrome;
    });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        const cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      let input;
      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'Download All';
        form.appendChild(input);
      });

      it('has no effect when the URL is wrong', function() {
        const cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).not.toHaveBeenCalled();
      });

      it('uploads the page when the URL is right', function() {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'uploadAttachmentMenu');
        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
      });

      it('calls the upload method and responds to positive result', function() {
        const cd = singleDocContentDelegate;
        uploadFake = function(_, _, _, callback) { callback(true); };
        spyOn(cd.recap, 'uploadAttachmentMenu').and.callFake(uploadFake);
        spyOn(cd.notifier, 'showUpload');
        spyOn(history, 'replaceState');

        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
        expect(cd.notifier.showUpload).toHaveBeenCalled();
        expect(history.replaceState)
            .toHaveBeenCalledWith({uploaded : true}, '');
      });

      it('calls the upload method and responds to negative result', function() {
        const cd = singleDocContentDelegate;
        uploadFake = function(_, _, _, callback) { callback(false); };
        spyOn(cd.recap, 'uploadAttachmentMenu').and.callFake(uploadFake);
        spyOn(cd.notifier, 'showUpload');
        spyOn(history, 'replaceState');

        cd.handleAttachmentMenuPage();
        expect(cd.recap.uploadAttachmentMenu).toHaveBeenCalled();
        expect(cd.notifier.showUpload).not.toHaveBeenCalled();
        expect(history.replaceState).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleSingleDocumentPageCheck', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.remove();
    });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        const cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      let input;
      let table;

      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);

        table = document.createElement('table');
        const table_tr = document.createElement('tr');
        const table_td = document.createElement('td');
        table_td.appendChild(document.createTextNode('Image'));
        table_tr.appendChild(table_td);
        table.appendChild(table_tr);
        document.body.appendChild(table);
      });

      afterEach(function() {
        // no need to remove input because it is added to
        // the form and removed in the outer scope
        table.remove();
      });

      it('has no effect when the URL is wrong', function() {
        const cd = nonsenseUrlContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });

      it('checks availability for the page when the URL is right', function() {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageCheck();
        expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
      });

      describe('for pacer doc id 531591', function() {
        beforeEach(function() {
          window.pacer_doc_id = 531591;
        });

        afterEach(function() {
          delete window.pacer_doc_id
        });

        it('responds to a positive result', function() {
          const fakePacerDocId = 531591;
          const cd = singleDocContentDelegate;
          const fake = function (_, _, callback) {
            const response = {
              results: [{
                pacer_doc_id: fakePacerDocId,
                filepath_local: 'download/1234'
              }]
            };
            callback(response);
          };
          spyOn(cd.recap, 'getAvailabilityForDocuments').and.callFake(fake);

          cd.handleSingleDocumentPageCheck();

          expect(cd.recap.getAvailabilityForDocuments).toHaveBeenCalled();
          const banner = document.querySelector('.recap-banner');
          expect(banner).not.toBeNull();
          const link = banner.querySelector('a');
          expect(link).not.toBeNull();
          expect(link.href).toBe('https://www.courtlistener.com/download/1234');
        });
      });
    });
  });

  describe('handleSingleDocumentPageView', function() {
    let form;
    beforeEach(function() {
      form = document.createElement('form');
      document.body.appendChild(form);
    });

    afterEach(function() {
      form.remove();
    });

    describe('when there is NO appropriate form', function() {
      it('has no effect when the URL is wrong', function() {
        const cd = nonsenseUrlContentDelegate;
        spyOn(document, 'createElement');
        cd.handleSingleDocumentPageView();
        expect(document.createElement).not.toHaveBeenCalled();
      });

      it('has no effect with a proper URL', function() {
        const cd = singleDocContentDelegate;
        spyOn(cd.recap, 'getAvailabilityForDocuments');
        cd.handleSingleDocumentPageView();
        expect(cd.recap.getAvailabilityForDocuments).not.toHaveBeenCalled();
      });
    });

    describe('when there IS an appropriate form', function() {
      let input;
      let table;

      beforeEach(function() {
        input = document.createElement('input');
        input.value = 'View Document';
        form.appendChild(input);

        table = document.createElement('table');
        const table_tr = document.createElement('tr');
        const table_td = document.createElement('td');
        table_td.appendChild(document.createTextNode('Image'));
        table_tr.appendChild(table_td);
        table.appendChild(table_tr);
        document.body.appendChild(table);
      });

      afterEach(function() {
        table.remove();
        const scripts = document.body.getElementsByTagName('script');
        const lastScript = scripts[scripts.length - 1];
        if (lastScript.innerText.includes('document.createElement("form")')) {
          lastScript.remove();
        }
      });

      it('creates a non-empty script element', function() {
        const cd = singleDocContentDelegate;
        const scriptSpy = {};
        spyOn(document, 'createElement').and.returnValue(scriptSpy);
        spyOn(document.body, 'appendChild');
        cd.handleSingleDocumentPageView();

        expect(document.createElement).toHaveBeenCalledWith('script');
        expect(scriptSpy.innerText).toEqual(jasmine.any(String));
        expect(document.body.appendChild).toHaveBeenCalledWith(scriptSpy);
      });

      it('adds an event listener for the message in the script', function() {
        const cd = singleDocContentDelegate;
        spyOn(window, 'addEventListener');
        cd.handleSingleDocumentPageView();

        expect(window.addEventListener)
            .toHaveBeenCalledWith('message', jasmine.any(Function), false);
      });
    });
  });

  describe('onDocumentViewSubmit', function() {
    let form;
    let table;
    const form_id = '1234';
    const event = {data: {id: form_id}};

    beforeEach(function() {
      form = document.createElement('form');
      form.id = form_id;
      document.body.appendChild(form);

      table = document.createElement('table');
      let tr_image = document.createElement('tr');
      let td_image = document.createElement('td');
      td_image.innerHTML = 'Image 1234-9876';
      tr_image.appendChild(td_image);
      table.appendChild(tr_image);
      document.body.appendChild(table);
    });

    afterEach(function() {
      form.remove();
      table.remove();
    });

    it('sets the onsubmit attribute of the page form', function() {
      const expected_on_submit = 'expectedOnSubmit();';
      form.setAttribute('onsubmit', expected_on_submit);
      spyOn(form, 'setAttribute');
      singleDocContentDelegate.onDocumentViewSubmit(event);

      expect(form.setAttribute)
          .toHaveBeenCalledWith('onsubmit', 'history.forward(); return false;');
      expect(form.setAttribute)
          .toHaveBeenCalledWith('onsubmit', expected_on_submit);
    });

    it('calls showPdfPage when the response is a PDF', function() {
      const cd = singleDocContentDelegate;
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'application/pdf',
        'responseText' : pdf_data
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });

    it('calls showPdfPage when the response is HTML', function() {
      const cd = singleDocContentDelegate;
      const fakeFileReader = {
        readAsText: function () {
          this.result = '<html lang="en"></html>';
          this.onload();
        }
      };
      spyOn(window, 'FileReader')
          .and.callFake(function() { return fakeFileReader; });
      spyOn(cd, 'showPdfPage');
      cd.onDocumentViewSubmit(event);

      jasmine.Ajax.requests.mostRecent().respondWith({
        'status' : 200,
        'contentType' : 'text/html',
        'responseText' : '<html lang="en"></html>'
      });
      expect(cd.showPdfPage).toHaveBeenCalled();
    });
  });

  describe('showPdfPage', function() {
    let documentElement;
    const pre = ('<head><title>test</title><style>body { margin: 0; } iframe { border: none; }' +
      '</style></head><body>');
    const iframe = '<iframe src="data:pdf"';
    const post = ' width="100%" height="100%"></iframe></body>';
    const html = pre + iframe + post;
    const cd = singleDocContentDelegate;

    beforeEach(function() {
      documentElement = jasmine.createSpy();
      cd.showPdfPage(documentElement, html, '');
    });

    it('correctly extracts the data before and after the iframe', function() {
      const waiting = '<p>Waiting for download...<p>';
      const expected_iframe = '<iframe src="about:blank"';
      expect(documentElement.innerHTML)
          .toBe(pre + waiting + expected_iframe + post);
    });

    describe('when it downloads the PDF in the iframe', function() {
      const casenum = '437098';

      beforeEach(function() {
        const fakeGet = function (_, callback) {
          callback(casenum);
        };
        const fakeUpload = function (_, _, _, _, _, _, callback) {
          callback(true);
        };

        spyOn(cd.recap, 'getPacerCaseIdFromPacerDocId').and.callFake(fakeGet);
        spyOn(cd.recap, 'uploadDocument').and.callFake(fakeUpload);
        spyOn(cd.notifier, 'showUpload');
        spyOn(URL, 'createObjectURL').and.returnValue('data:blob');
        spyOn(history, 'pushState');
        spyOn(window, 'saveAs');
        jasmine.Ajax.requests.mostRecent().respondWith({
          'status' : 200,
          'contentType' : 'application/pdf',
          'responseText' : pdf_data
        });
      });

      it('makes the back button redisplay the previous page', function() {
        expect(window.onpopstate).toEqual(jasmine.any(Function));
        window.onpopstate({state : {content : 'previous'}});
        expect(documentElement.innerHTML).toBe('previous');
      });

      it('displays the page with the downloaded file in an iframe', function() {
        if ((navigator.userAgent.indexOf('Chrome') >= 0) &&
            !navigator.plugins.namedItem('Chrome PDF Viewer')) {
          // isExternalPdf, file is saved with saveAs
          expect(documentElement.innerHTML)
              .toMatch(/<iframe.*?src="about:blank".*?><\/iframe>/);
          expect(window.saveAs).toHaveBeenCalled();
        } else {
          expect(documentElement.innerHTML)
              .toMatch(/<iframe.*?src="data:blob".*?><\/iframe>/);
        }
      });

      it('puts the generated HTML in the page history', function() {
        if ((navigator.userAgent.indexOf('Chrome') >= 0) &&
            !navigator.plugins.namedItem('Chrome PDF Viewer')) {
          // isExternalPdf, file is saved with saveAs
          expect(history.pushState).not.toHaveBeenCalled();
          expect(window.saveAs).toHaveBeenCalled();
        } else {
          expect(history.pushState).toHaveBeenCalled();
        }
      });

      it('uploads the PDF to RECAP',
         function() { expect(cd.recap.uploadDocument).toHaveBeenCalled(); });

      it('calls the notifier once the upload finishes',
         function() { expect(cd.notifier.showUpload).toHaveBeenCalled(); });
    });
  });

  function linksFromUrls(urls) {
    let index;
    const links = [];
    for (index = 0; index < urls.length; index++) {
      const link = document.createElement('a');
      link.href = urls[index];
      if (index === 0) {
        link.dataset.pacer_doc_id = '1234';
      }
      links.push(link);
    }
    return links;
  }

  describe('findAndStorePacerDocIds', function() {
    it('should handle no cookie', function () {
      spyOn(PACER, 'hasPacerCookie').and.returnValue(false);
      expect(nonsenseUrlContentDelegate.findAndStorePacerDocIds()).toBe(undefined);
    });
    // TODO: Add more tests for findAndStorePacerDocIds
  });

  // TODO: Figure out where the functionality of
  //  'addMouseoverToConvertibleLinks' went, and add tests for that.

  describe('handleRecapLinkClick', function() {
    const cd = docketDisplayContentDelegate;
    const linkUrl = singleDocUrl;

    afterEach(function() {
      delete window.chrome;
    });

    describe('when the popup option is not set', function() {
      beforeEach(function() {
        window.chrome = {
          storage : {
            local : {
              get : jasmine.createSpy().and.callFake(function(
                  _, cb) { cb({options : {}}); })
            }
          }
        };
      });

      it('redirects to the link url immediately', function() {
        const window_obj = {};
        cd.handleRecapLinkClick(window_obj, linkUrl);
        expect(window_obj.location).toBe(linkUrl);
      });
    });

    describe('when the popup option is set', function() {
      beforeEach(function() {
        window.chrome = {
          storage : {
            local : {
              get : jasmine.createSpy().and.callFake(function(
                  _, cb) { cb({options : {recap_link_popups : true}}); })
            }
          }
        };
      });

      it('attaches the RECAP popup', function() {
        cd.handleRecapLinkClick({}, linkUrl);
        expect($('#recap-shade').length).not.toBe(0);
        expect($('.recap-popup').length).not.toBe(0);

        let foundLink = false;
        $('.recap-popup a').each(function(i, link) {
          if (link.href === linkUrl) {
            foundLink = true;
          }
        });
        expect(foundLink).toBe(true);
        document.getElementById('recap-shade').remove();
        document.getElementsByClassName('recap-popup')[0].remove();
      });
    });
  });

  describe('attachRecapLinkToEligibleDocs', function() {
    const fake_urls = [
      'http://foo.fake/bar/0',
      'http://foo.fake/bar/1',
    ];

    const urls = [
      'https://ecf.canb.uscourts.gov/doc1/034031424909',
      'https://ecf.canb.uscourts.gov/doc1/034031438754',
    ];

    describe('when there are no valid urls', function() {
      let links;
      let cd;
      beforeEach(function() {
        links = linksFromUrls(fake_urls);
        cd = new ContentDelegate(null, null, null, null, null, links);
        cd.attachRecapLinkToEligibleDocs();
      });

      it('does nothing', function() {
        expect(jasmine.Ajax.requests.mostRecent()).toBeUndefined();
      });
    });

    describe('when there are valid urls', function() {
      let links;
      let cd;
      beforeEach(function() {
        links = linksFromUrls(urls);
        $('body').append(links);
        cd = new ContentDelegate(null, null, null, null, null, links);
        cd.pacer_doc_ids = [ 1234 ];
      });

      afterEach(function() {
        for (let link of links) {
          link.remove();
        }
      });

      it('does not attach any links if no urls have recap', function() {
        spyOn(cd.recap, 'getAvailabilityForDocuments')
            .and.callFake(function(_, _, callback) {
              callback({
                results : [],
              });
            });
        cd.attachRecapLinkToEligibleDocs();
        expect($('.recap-inline').length).toBe(0);
      });

      it('attaches a single link to the one url with recap', function() {
        spyOn(cd.recap, 'getAvailabilityForDocuments')
            .and.callFake(function(_, _, callback) {
              callback({
                results :
                    [ {pacer_doc_id : 1234, filepath_local : 'download/1234'} ],
              });
            });
        cd.attachRecapLinkToEligibleDocs();
        expect($('.recap-inline').length).toBe(1);
        document.getElementsByClassName('recap-inline')[0].remove();
      });

      it('attaches a working click handler', function() {
        spyOn(cd, 'handleRecapLinkClick');
        spyOn(cd.recap, 'getAvailabilityForDocuments')
            .and.callFake(function(_, _, callback) {
              callback({
                results :
                    [ {pacer_doc_id : 1234, filepath_local : 'download/1234'} ],
              });
            });
        cd.attachRecapLinkToEligibleDocs();
        $(links[0]).next().click();
        expect(cd.handleRecapLinkClick).toHaveBeenCalled();
        document.getElementsByClassName('recap-inline')[0].remove();
      });
    });
  });
});
